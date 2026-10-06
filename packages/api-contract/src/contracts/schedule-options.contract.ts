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
  ReasonCode,
  ScheduleLimitation,
  ScheduleLimitationSchema,
  ScheduleOutcome,
  ScheduleOutcomeSchema,
} from '@caa/domain';

import { defineEndpoint } from '../define-endpoint';
import { CourseDisplayListSchema } from './course-display.contract';
import { ConflictSetSchema } from './schedule-conflict-set.contract';
import {
  MAX_SCHEDULE_OPTIONS,
  type ScheduleOption,
  ScheduleOptionSchema,
} from './schedule-option.contract';
import { MAX_SCHEDULE_OPTION_COURSES } from './schedule-options-request.contract';
import { SchedulePinnedInputsSchema } from './schedule-pinned-inputs.contract';

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

/**
 * Returns whether every option carries the same academic checks: per-course results (compared
 * by course) and allocation. Only the credit load and schedule feasibility may differ.
 *
 * @param response - The options to compare.
 * @returns `false` when two options disagree on a prerequisite, applicability, or allocation.
 */
function hasSameAcademicChecks(response: { readonly options: readonly ScheduleOption[] }): boolean {
  // NOTE: the values are parsed schema output, whose keys follow the schema's order, so equal
  // values serialize to equal JSON.
  const keys = response.options.map((option) =>
    JSON.stringify({
      courseResults: [...option.courseResults].sort((first, second) =>
        first.courseId < second.courseId ? -1 : first.courseId > second.courseId ? 1 : 0,
      ),
      allocation: option.setResults.allocation,
    }),
  );
  return keys.every((key) => key === keys[0]);
}

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
     * `NEEDS_VERIFICATION`; empty for every other outcome. Each is `SECTION_DATA_MISSING` or
     * `LINKED_SECTION_UNAVAILABLE`, the two reasons a course can have no bundle (ADR-0010 §5).
     */
    unresolved: z
      .array(
        CheckResultSchema.refine(
          (check) =>
            check.state === CheckState.Unknown &&
            check.kind === CheckKind.ScheduleFeasibility &&
            (check.reasonCode === ReasonCode.SectionDataMissing ||
              check.reasonCode === ReasonCode.LinkedSectionUnavailable),
          {
            message:
              'An unresolved item is an UNKNOWN SCHEDULE_FEASIBILITY check for missing sections',
          },
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
  // SAFETY: the academic checks don't depend on sections and are computed once for the
  // request (ADR-0010 §2), so two options must never show one course's prerequisite,
  // applicability, or allocation differently.
  .refine(hasSameAcademicChecks, {
    message: 'Every option must carry the same courseResults and allocation',
    path: ['options'],
  })
  // SAFETY: every requested course is required, so each option schedules exactly the requested
  // courses, one bundle each (ADR-0010 §2 and §3). An option that dropped a course would also
  // drop that course's checks, so a FAIL or UNKNOWN prerequisite could vanish from its
  // aggregate. The option schema already makes its bundles and `courseResults` distinct and
  // equal as sets, so matching the bundles against `courseIds` covers both.
  .refine(
    (response) =>
      response.options.every(
        (option) =>
          option.bundles.length === response.courseIds.length &&
          response.courseIds.every((courseId) =>
            option.bundles.some((bundle) => bundle.courseId === courseId),
          ),
      ),
    {
      message: 'Every option must schedule every requested course, one bundle each',
      path: ['options'],
    },
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
        [...option.courseResults, ...option.linkedCourseResults].every(
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
