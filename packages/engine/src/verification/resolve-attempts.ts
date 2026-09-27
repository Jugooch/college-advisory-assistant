/**
 * @file Groups a student's attempts by equivalency group and resolves the one that counts.
 * @module @caa/engine/verification/resolve-attempts
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  AttemptStatus,
  CountingState,
  type Course,
  type CourseAttempt,
  type CourseId,
  type EquivalencyGroupId,
  ReasonCode,
} from '@caa/domain';

import {
  type AttemptResolutionContext,
  type CountingResolution,
  selectCountingAttempt,
} from './select-counting-attempt';

/** A student's attempts at one course, or at any course of one equivalency group. */
export interface AttemptGroup {
  /** `equivalency:<id>` for an equivalency group, `course:<id>` for a course without one. */
  readonly groupKey: string;
  /** The shared equivalency group, or `null` when the group is a single course. */
  readonly equivalencyGroupId: EquivalencyGroupId | null;
  /** Distinct course IDs attempted in this group, sorted. */
  readonly courseIds: readonly CourseId[];
  /** The one attempt that counts, if it can be determined. At most one per group. */
  readonly counting: CountingResolution;
  /** IN_PROGRESS attempts. They earn nothing yet. */
  readonly inProgress: readonly CourseAttempt[];
  /** TRANSFER_PENDING attempts. They never earn credit until awarded. */
  readonly pendingTransfer: readonly CourseAttempt[];
  /** Every attempt in the group, in input order, kept as evidence. */
  readonly attempts: readonly CourseAttempt[];
}

/** Statuses whose attempts can count and earn credit. */
const COUNTABLE_STATUSES: readonly AttemptStatus[] = [
  AttemptStatus.Completed,
  AttemptStatus.TransferAwarded,
];

interface GroupDraft {
  readonly equivalencyGroupId: EquivalencyGroupId | null;
  readonly attempts: CourseAttempt[];
}

/** Resolves a group's counting attempt from its COMPLETED and TRANSFER_AWARDED attempts. */
type CountingSelector = (completed: readonly CourseAttempt[]) => CountingResolution;

/** Every group's resolution when the catalog doesn't cover every attempted course. */
const CATALOG_INCOMPLETE: CountingResolution = {
  state: CountingState.Undetermined,
  reasonCode: ReasonCode.CourseNotInCatalog,
  earnedCreditsHundredths: null,
};

/**
 * Groups attempts by equivalency group, or by course when the course has none, and resolves
 * each group's counting attempt so that repeats and aliases never earn credit twice.
 *
 * Earned credit for a group is the counting attempt's `creditsEarnedHundredths`, for fixed and
 * variable-credit courses alike; the course's credit fields are never used as a fallback.
 *
 * If any attempt's course is missing from `courses`, every group is UNDETERMINED
 * (`COURSE_NOT_IN_CATALOG`), because the missing course could be an alias in any group.
 *
 * @param attempts - The student's attempts, in any order.
 * @param courses - Catalog courses covering every attempted course.
 * @param context - The academic policy (whose `repeatPolicy` decides which repeat counts; `null`
 *   leaves groups with several completed or awarded attempts UNDETERMINED) and the term order.
 *   It is required so a caller can't omit the policy by accident.
 * @returns One group per equivalency group or standalone course, sorted by `groupKey`.
 */
export function resolveAttempts(
  attempts: readonly CourseAttempt[],
  courses: readonly Course[],
  context: AttemptResolutionContext,
): readonly AttemptGroup[] {
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const drafts = new Map<string, GroupDraft>();
  for (const attempt of attempts) {
    const course = courseById.get(attempt.courseId);
    const equivalencyGroupId = course?.equivalencyGroupId ?? null;
    const groupKey =
      equivalencyGroupId === null
        ? `course:${attempt.courseId}`
        : `equivalency:${equivalencyGroupId}`;
    const draft = drafts.get(groupKey) ?? { equivalencyGroupId, attempts: [] };
    draft.attempts.push(attempt);
    drafts.set(groupKey, draft);
  }
  // SAFETY: a course missing from the catalog could be an alias in any equivalency group, and
  // the engine can't tell which. Missing data must not produce a settled answer, so every
  // group is UNDETERMINED rather than only the missing course's own group (planning/08
  // §Candidate formation: never count two aliases of the same course as separate credits).
  const isCatalogComplete = attempts.every((attempt) => courseById.has(attempt.courseId));
  const selectCounting: CountingSelector = isCatalogComplete
    ? (completed) => selectCountingAttempt(completed, context)
    : () => CATALOG_INCOMPLETE;
  // NOTE: keys are compared by UTF-16 code unit, not localeCompare, so the order is the same
  // on every machine.
  return [...drafts.entries()]
    .sort(([left], [right]) => Number(left > right) - Number(left < right))
    .map(([groupKey, draft]) => toAttemptGroup(groupKey, draft, selectCounting));
}

/**
 * Finishes one group: splits attempts by status and resolves the counting attempt.
 *
 * @param groupKey - The group's key.
 * @param draft - The group's collected attempts.
 * @param selectCounting - Resolves the counting attempt from the group's countable attempts.
 * @returns The resolved group.
 */
function toAttemptGroup(
  groupKey: string,
  draft: GroupDraft,
  selectCounting: CountingSelector,
): AttemptGroup {
  const withStatus = (statuses: readonly AttemptStatus[]): readonly CourseAttempt[] =>
    draft.attempts.filter((attempt) => statuses.includes(attempt.status));
  return {
    groupKey,
    equivalencyGroupId: draft.equivalencyGroupId,
    courseIds: [...new Set(draft.attempts.map((attempt) => attempt.courseId))].sort(),
    counting: selectCounting(withStatus(COUNTABLE_STATUSES)),
    inProgress: withStatus([AttemptStatus.InProgress]),
    // SAFETY: pending transfers are reported separately and never count as earned credit
    // (planning/08 §Eligibility semantics).
    pendingTransfer: withStatus([AttemptStatus.TransferPending]),
    attempts: [...draft.attempts],
  };
}
