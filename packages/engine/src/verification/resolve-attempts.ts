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
  type RepeatableForCredit,
} from '@caa/domain';

import { countRepeatCredit, type RepeatCreditResolution } from './count-repeat-credit';
import { type GroupRepeatStatement, groupRepeatStatement } from './group-repeat-statement';
import {
  type AttemptResolutionContext,
  type CountingResolution,
  selectCountingAttempt,
} from './select-counting-attempt';

/**
 * Which attempts of a group count. A group is repeatable for credit when every catalog course
 * of it states the same `repeatableForCredit`; then several attempts can count (`attempts`,
 * see `countRepeatCredit`). Otherwise at most one counts, chosen by the repeat policy.
 */
export type GroupCounting =
  | {
      /** `null`: no statement, or the group's courses disagree. */
      readonly repeatableForCredit: null;
      readonly counting: CountingResolution;
    }
  | {
      /** The statement shared by every catalog course of the group. */
      readonly repeatableForCredit: RepeatableForCredit;
      readonly counting: RepeatCreditResolution;
    };

/** A student's attempts at one course, or at any course of one equivalency group. */
export type AttemptGroup = AttemptGroupFields & GroupCounting;

/** The fields of an {@link AttemptGroup} that don't depend on how its attempts count. */
interface AttemptGroupFields {
  /** `equivalency:<id>` for an equivalency group, `course:<id>` for a course without one. */
  readonly groupKey: string;
  /** The shared equivalency group, or `null` when the group is a single course. */
  readonly equivalencyGroupId: EquivalencyGroupId | null;
  /** Distinct course IDs attempted in this group, sorted. */
  readonly courseIds: readonly CourseId[];
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

/** Resolves a group's counting attempts from its COMPLETED and TRANSFER_AWARDED attempts. */
type CountingSelector = (
  completed: readonly CourseAttempt[],
  statement: GroupRepeatStatement,
) => GroupCounting;

/** Every group's resolution when the catalog doesn't cover every attempted course. */
const CATALOG_INCOMPLETE: GroupCounting = {
  repeatableForCredit: null,
  counting: {
    state: CountingState.Undetermined,
    reasonCode: ReasonCode.CourseNotInCatalog,
    earnedCreditsHundredths: null,
  },
};

const STATEMENTS_CONFLICT: GroupCounting = {
  repeatableForCredit: null,
  counting: {
    state: CountingState.Undetermined,
    reasonCode: ReasonCode.RepeatPolicyUndefined,
    earnedCreditsHundredths: null,
  },
};

/**
 * Groups attempts by equivalency group, or by course when the course has none, and resolves
 * each group's counting attempt so that repeats and aliases never earn credit twice.
 *
 * Earned credit for a group is the counting attempt's `creditsEarnedHundredths`, for fixed and
 * variable-credit courses alike; the course's credit fields are never used as a fallback. When
 * every catalog course of the group states the same `repeatableForCredit`, several attempts
 * can count within its caps (see `countRepeatCredit`); when they state different values, a
 * group with two or more completed or awarded attempts is UNDETERMINED
 * (`REPEAT_POLICY_UNDEFINED`).
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
    ? (completed, statement) => resolveCounting(completed, statement, { context, courseById })
    : () => CATALOG_INCOMPLETE;
  // NOTE: keys are compared by UTF-16 code unit, not localeCompare, so the order is the same
  // on every machine.
  return [...drafts.entries()]
    .sort(([left], [right]) => Number(left > right) - Number(left < right))
    .map(([groupKey, draft]) => {
      const groupCourses = courses.filter((course) =>
        draft.equivalencyGroupId === null
          ? course.id === draft.attempts[0]?.courseId
          : course.equivalencyGroupId === draft.equivalencyGroupId,
      );
      return toAttemptGroup(
        { groupKey, draft, statement: groupRepeatStatement(groupCourses) },
        selectCounting,
      );
    });
}

/**
 * Resolves a group's counting attempts under its repeat-for-credit statement.
 *
 * @param completed - The group's COMPLETED and TRANSFER_AWARDED attempts.
 * @param statement - The statement shared by the group's catalog courses.
 * @param inputs - The academic policy and term order, and the catalog by course ID.
 * @param inputs.context - The academic policy and the term order.
 * @param inputs.courseById - The catalog by course ID.
 * @returns The group's statement and counting resolution.
 */
function resolveCounting(
  completed: readonly CourseAttempt[],
  statement: GroupRepeatStatement,
  inputs: {
    readonly context: AttemptResolutionContext;
    readonly courseById: ReadonlyMap<CourseId, Course>;
  },
): GroupCounting {
  const { context, courseById } = inputs;
  // SAFETY: when the catalog disagrees on whether a repeat earns credit again, the engine can't
  // tell how many attempts count. A single attempt is unaffected (ADR-0012 §2: when it
  // applies; AC04).
  if (statement.isConflict && completed.length >= 2) {
    return STATEMENTS_CONFLICT;
  }
  // SAFETY: without an explicit statement only one attempt ever counts (AC04: no duplicate
  // earned credit unless policy explicitly permits it).
  if (statement.isConflict || statement.statement === null) {
    return { repeatableForCredit: null, counting: selectCountingAttempt(completed, context) };
  }
  return {
    repeatableForCredit: statement.statement,
    counting: countRepeatCredit(completed, { statement: statement.statement, courseById }, context),
  };
}

/**
 * Finishes one group: splits attempts by status and resolves the counting attempts.
 *
 * @param group - The group's key, its collected attempts, and its catalog statement.
 * @param group.groupKey - The group's key.
 * @param group.draft - The group's collected attempts.
 * @param group.statement - The repeat-for-credit statement of the group's catalog courses.
 * @param selectCounting - Resolves the counting attempts from the group's countable attempts.
 * @returns The resolved group.
 */
function toAttemptGroup(
  group: {
    readonly groupKey: string;
    readonly draft: GroupDraft;
    readonly statement: GroupRepeatStatement;
  },
  selectCounting: CountingSelector,
): AttemptGroup {
  const { groupKey, draft, statement } = group;
  const withStatus = (statuses: readonly AttemptStatus[]): readonly CourseAttempt[] =>
    draft.attempts.filter((attempt) => statuses.includes(attempt.status));
  return {
    groupKey,
    equivalencyGroupId: draft.equivalencyGroupId,
    courseIds: [...new Set(draft.attempts.map((attempt) => attempt.courseId))].sort(),
    ...selectCounting(withStatus(COUNTABLE_STATUSES), statement),
    inProgress: withStatus([AttemptStatus.InProgress]),
    // SAFETY: pending transfers are reported separately and never count as earned credit
    // (planning/08 §Eligibility semantics).
    pendingTransfer: withStatus([AttemptStatus.TransferPending]),
    attempts: [...draft.attempts],
  };
}
