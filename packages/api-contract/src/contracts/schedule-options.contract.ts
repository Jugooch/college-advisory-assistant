/**
 * @file Contract for schedule options: up to three validated options on pinned inputs, or a
 *   verified reason there are none. The request body and one option live in their own files.
 * @module @caa/api-contract/contracts/schedule-options
 * @requirement FR-02
 * @requirement FR-07
 * @requirement FR-08
 * @requirement FR-09
 * @requirement FR-10
 * @requirement FR-18
 * @requirement NFR-01
 * @requirement NFR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { z } from 'zod';

import {
  CheckKind,
  CheckResultSchema,
  CheckState,
  CourseIdSchema,
  ScheduleLimitation,
  ScheduleLimitationSchema,
  ScheduleOutcome,
  ScheduleOutcomeSchema,
  SectionSnapshotIdSchema,
} from '@caa/domain';

import { defineEndpoint } from '../define-endpoint';
import { PinnedInputsSchema } from './course-checks.contract';
import { CourseDisplayListSchema } from './course-display.contract';
import {
  MAX_SCHEDULE_OPTIONS,
  type ScheduleOption,
  ScheduleOptionSchema,
} from './schedule-option.contract';
import { MAX_SCHEDULE_OPTION_COURSES } from './schedule-options-request.contract';

/**
 * Returns whether a list has no repeated values.
 *
 * @param values - Values to check.
 * @returns `true` when every value appears once.
 */
function isDistinct(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/** What each outcome carries (ADR-0010 §5). `null` for `searchComplete` means either value. */
const OUTCOME_SHAPE: Readonly<
  Record<
    ScheduleOutcome,
    {
      readonly searchComplete: boolean | null;
      readonly hasOptions: boolean;
      readonly hasConflictSet: boolean;
      readonly hasUnresolved: boolean;
    }
  >
> = {
  [ScheduleOutcome.OptionsFound]: {
    searchComplete: null,
    hasOptions: true,
    hasConflictSet: false,
    hasUnresolved: false,
  },
  [ScheduleOutcome.NoFeasiblePlan]: {
    searchComplete: true,
    hasOptions: false,
    hasConflictSet: true,
    hasUnresolved: false,
  },
  [ScheduleOutcome.SearchTimeout]: {
    searchComplete: false,
    hasOptions: false,
    hasConflictSet: false,
    hasUnresolved: false,
  },
  [ScheduleOutcome.NeedsVerification]: {
    searchComplete: false,
    hasOptions: false,
    hasConflictSet: false,
    hasUnresolved: true,
  },
};

/**
 * Returns whether a response carries exactly the evidence its outcome calls for.
 *
 * @param response - The outcome and the fields it governs.
 * @returns `false` when a field is present, absent, or set in a way the outcome forbids.
 */
function hasOutcomeShape(response: {
  readonly outcome: ScheduleOutcome;
  readonly searchComplete: boolean;
  readonly options: readonly unknown[];
  readonly conflictSet: object | null;
  readonly unresolved: readonly unknown[];
}): boolean {
  const shape = OUTCOME_SHAPE[response.outcome];
  return (
    (shape.searchComplete === null || shape.searchComplete === response.searchComplete) &&
    shape.hasOptions === response.options.length > 0 &&
    shape.hasConflictSet === (response.conflictSet !== null) &&
    shape.hasUnresolved === response.unresolved.length > 0
  );
}

/**
 * Returns whether options are ranked 1 to n in list order, every PASS schedule comes before
 * every UNKNOWN one, and no two options use the same sections.
 *
 * @param response - The options to check.
 * @returns `false` when a rank is out of place, the order puts UNKNOWN first, or two options
 *   have the same section set.
 */
function isRankedAndDistinct(response: { readonly options: readonly ScheduleOption[] }): boolean {
  const { options } = response;
  const sectionSets = options.map((option) =>
    option.bundles
      .flatMap((bundle) => bundle.sections.map((section) => section.sectionId))
      .sort()
      .join(','),
  );
  const passCount = options.filter(
    (option) => option.scheduleFeasibility.state === CheckState.Pass,
  ).length;
  return (
    options.every((option, index) => option.rank === index + 1) &&
    options.every(
      (option, index) =>
        (option.scheduleFeasibility.state === CheckState.Pass) === index < passCount,
    ) &&
    isDistinct(sectionSets)
  );
}

/** Most solver work units a request may use (ADR-0010 §1). */
export const MAX_SOLVER_WORK_CAP = 3_000_000;

/** Most conflicts a `conflictSet` lists; the rest are counted in `omittedCount`. */
export const MAX_CONFLICT_SET_ITEMS = 20;

/**
 * The inputs every option was computed from, so the response can be reproduced: the course
 * checks' pinned inputs plus the section data, the transition table, the work cap, and the
 * request itself (ADR-0010 §7). The same pinned inputs and cap give a deep-equal response.
 */
export const SchedulePinnedInputsSchema = PinnedInputsSchema.unwrap()
  .extend({
    sectionSnapshotId: SectionSnapshotIdSchema,
    /**
     * Version of the tenant's campus transition table, or `null` when the tenant has none, in
     * which case every pair of different campuses is unknown, never zero minutes.
     */
    campusTransitionVersion: z.string().min(1).nullable(),
    /** The solver work cap the search ran under (ADR-0010 §1). */
    solverWorkCap: z.number().int().min(1).max(MAX_SOLVER_WORK_CAP),
    /** `sha256:` and the lowercase hex SHA-256 of the normalized request's canonical JSON. */
    constraintHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  })
  .readonly();

/**
 * Verified conflicts behind `NO_FEASIBLE_PLAN`: distinct FAIL results the solver's checks
 * produced on the pinned inputs. It is never described as minimal, because minimality isn't
 * checked (planning/08 §Constraint formulation).
 */
export const ConflictSetSchema = z
  .object({
    items: z
      .array(
        CheckResultSchema.refine(
          (check) =>
            check.state === CheckState.Fail &&
            (check.kind === CheckKind.ScheduleFeasibility || check.kind === CheckKind.CreditLoad),
          { message: 'A conflict is a FAIL SCHEDULE_FEASIBILITY or CREDIT_LOAD check' },
        ),
      )
      .min(1)
      .max(MAX_CONFLICT_SET_ITEMS)
      .readonly(),
    /** Always `false` in S4: the set is verified, not proven minimal. */
    isMinimal: z.literal(false),
    /** Conflicts left out after the first {@link MAX_CONFLICT_SET_ITEMS}. */
    omittedCount: z.number().int().nonnegative(),
  })
  .readonly();

/** Response body for `POST /v1/students/:studentId/schedule-options`. */
export const ScheduleOptionsResponseSchema = z
  .object({
    outcome: ScheduleOutcomeSchema,
    /** `false` when the work cap stopped the search, or the search didn't run. */
    searchComplete: z.boolean(),
    /** The requested courses, in request order. */
    courseIds: z.array(CourseIdSchema).min(1).max(MAX_SCHEDULE_OPTION_COURSES).readonly(),
    /** Up to three options, best first. Empty unless the outcome is `OPTIONS_FOUND`. */
    options: z.array(ScheduleOptionSchema).max(MAX_SCHEDULE_OPTIONS).readonly(),
    /** Verified conflicts for `NO_FEASIBLE_PLAN`; `null` for every other outcome. */
    conflictSet: ConflictSetSchema.nullable(),
    /**
     * UNKNOWN SCHEDULE_FEASIBILITY results saying which data is missing, for
     * `NEEDS_VERIFICATION`; empty for every other outcome.
     */
    unresolved: z
      .array(
        CheckResultSchema.refine(
          (check) =>
            check.state === CheckState.Unknown && check.kind === CheckKind.ScheduleFeasibility,
          { message: 'An unresolved item is an UNKNOWN SCHEDULE_FEASIBILITY check' },
        ),
      )
      .readonly(),
    /** Fixed codes for what the options don't establish. Always all of them. */
    limitations: z.array(ScheduleLimitationSchema).readonly(),
    pinnedInputs: SchedulePinnedInputsSchema,
    /** Catalog display fields for the requested and linked courses. Display data only. */
    courses: CourseDisplayListSchema,
  })
  .refine((response) => isDistinct(response.courseIds), {
    message: 'courseIds must not repeat a course',
    path: ['courseIds'],
  })
  // SAFETY: each outcome carries exactly the evidence ADR-0010 §5 gives it, so a capped search
  // is never shown as infeasible and a proven infeasibility always shows its conflicts.
  .refine(hasOutcomeShape, {
    message: 'searchComplete, options, conflictSet, and unresolved must match the outcome',
    path: ['outcome'],
  })
  // SAFETY: options are distinct, ranked 1 to n in order, and never rank an UNKNOWN schedule
  // above a PASS one (ADR-0010 §4).
  .refine(isRankedAndDistinct, {
    message: 'options must be distinct, ranked 1 to n, with PASS schedules before UNKNOWN ones',
    path: ['options'],
  })
  .refine(
    (response) =>
      response.options.every((option) =>
        option.bundles.every((bundle) => response.courseIds.includes(bundle.courseId)),
      ),
    { message: 'Every option must schedule only the requested courses', path: ['options'] },
  )
  // SAFETY: seats and registration are never checked here, and every response says so with
  // fixed codes, never free text (ADR-0010 §5).
  .refine(
    (response) =>
      isDistinct(response.limitations) &&
      Object.values(ScheduleLimitation).every((code) => response.limitations.includes(code)),
    { message: 'limitations must list every ScheduleLimitation code once', path: ['limitations'] },
  )
  // SAFETY: a prerequisite evaluated under another ruleset isn't reproducible from the pinned
  // inputs (planning/08 §Rule lifecycle).
  .refine(
    (response) =>
      response.options.every((option) =>
        option.courseResults.every(
          ({ prerequisite }) =>
            prerequisite?.evidence === undefined ||
            prerequisite.evidence.rulesetVersion === response.pinnedInputs.rulesetVersion,
        ),
      ),
    { message: 'Prerequisite evidence must use the pinned rulesetVersion', path: ['options'] },
  )
  // SECURITY: data minimization. Catalog entries are sent only for courses the response names.
  .refine(
    (response) => {
      const named = new Set<string>([
        ...response.courseIds,
        ...response.options.flatMap((option) =>
          option.bundles.flatMap((bundle) => bundle.sections.map((section) => section.courseId)),
        ),
      ]);
      return response.courses.every((course) => named.has(course.courseId));
    },
    { message: 'courses must list only courses the response names', path: ['courses'] },
  )
  .readonly();

/** Response body for `POST /v1/students/:studentId/schedule-options`. */
export type ScheduleOptionsResponse = z.infer<typeof ScheduleOptionsResponseSchema>;

/**
 * Finds up to three schedule options for one student the signed-in user may see, synchronously
 * on pinned inputs and bounded by the solver work cap (ADR-0010 §6). Others are NOT_FOUND. A
 * stale section snapshot is 409 `STALE_SOURCE`. Read-only: it registers nothing and writes
 * nothing to an institutional system.
 */
export const findScheduleOptionsEndpoint = defineEndpoint({
  method: 'POST',
  path: '/v1/students/:studentId/schedule-options',
  response: ScheduleOptionsResponseSchema,
});
