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
  isMissingCourse: boolean;
}

/**
 * Groups attempts by equivalency group, or by course when the course has none, and resolves
 * each group's counting attempt so that repeats and aliases never earn credit twice.
 *
 * Earned credit for a group is the counting attempt's `creditsEarnedHundredths`, for fixed and
 * variable-credit courses alike; the course's credit fields are never used as a fallback.
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
    const draft = drafts.get(groupKey) ?? {
      equivalencyGroupId,
      attempts: [],
      isMissingCourse: false,
    };
    draft.attempts.push(attempt);
    draft.isMissingCourse ||= course === undefined;
    drafts.set(groupKey, draft);
  }
  // NOTE: keys are compared by UTF-16 code unit, not localeCompare, so the order is the same
  // on every machine.
  return [...drafts.entries()]
    .sort(([left], [right]) => Number(left > right) - Number(left < right))
    .map(([groupKey, draft]) => toAttemptGroup(groupKey, draft, context));
}

/**
 * Finishes one group: splits attempts by status and resolves the counting attempt.
 *
 * @param groupKey - The group's key.
 * @param draft - The group's collected attempts.
 * @param context - The institution inputs for choosing the counting attempt.
 * @returns The resolved group.
 */
function toAttemptGroup(
  groupKey: string,
  draft: GroupDraft,
  context: AttemptResolutionContext,
): AttemptGroup {
  const withStatus = (statuses: readonly AttemptStatus[]): readonly CourseAttempt[] =>
    draft.attempts.filter((attempt) => statuses.includes(attempt.status));
  // SAFETY: a course missing from the catalog may belong to another attempt's equivalency
  // group, so counting it alone could double count an alias (planning/08 §Candidate formation).
  const counting: CountingResolution = draft.isMissingCourse
    ? {
        state: CountingState.Undetermined,
        reasonCode: ReasonCode.CourseNotInCatalog,
        earnedCreditsHundredths: null,
      }
    : selectCountingAttempt(withStatus(COUNTABLE_STATUSES), context);
  return {
    groupKey,
    equivalencyGroupId: draft.equivalencyGroupId,
    courseIds: [...new Set(draft.attempts.map((attempt) => attempt.courseId))].sort(),
    counting,
    inProgress: withStatus([AttemptStatus.InProgress]),
    // SAFETY: pending transfers are reported separately and never count as earned credit
    // (planning/08 §Eligibility semantics).
    pendingTransfer: withStatus([AttemptStatus.TransferPending]),
    attempts: [...draft.attempts],
  };
}
