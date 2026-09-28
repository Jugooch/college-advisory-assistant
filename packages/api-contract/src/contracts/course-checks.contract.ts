/**
 * @file Contract for checking a candidate course set against the pinned record, audit, and rules.
 * @module @caa/api-contract/contracts/course-checks
 * @requirement FR-01
 * @requirement FR-05
 * @requirement FR-09
 * @requirement FR-10
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import {
  AggregateState,
  AggregateStateSchema,
  CheckKind,
  type CheckResult,
  CheckResultSchema,
  CheckState,
  CourseIdSchema,
  StudentSnapshotIdSchema,
} from '@caa/domain';

import { defineEndpoint } from '../define-endpoint';

/** Most courses one course-checks request may name. */
export const MAX_COURSE_CHECK_COURSES = 12;

/**
 * Returns whether a list has no repeated values.
 *
 * @param values - Values to check.
 * @returns `true` when every value appears once.
 */
function isDistinct(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/**
 * Builds a check-result schema that accepts only one check kind.
 *
 * @param kind - The kind the check must have.
 * @returns `CheckResultSchema` with the kind pinned, so every evidence rule still applies.
 */
function checkOfKind(kind: CheckKind): typeof CheckResultSchema {
  return CheckResultSchema.refine((check) => check.kind === kind, {
    message: `Expected a ${kind} check`,
    path: ['kind'],
  });
}

// ---- Request ----

/** The credit value chosen for one variable-credit course. */
export const CreditSelectionSchema = z
  .strictObject({
    courseId: CourseIdSchema,
    /** Chosen credits in hundredths of a credit (350 = 3.5 credits). Never a float. */
    selectedCreditsHundredths: z.number().int().nonnegative(),
  })
  .readonly();

/**
 * Request body for `POST /v1/students/:studentId/course-checks`.
 *
 * SECURITY: strict. The body names courses and credit choices only; tenant, user, and role come
 * from the session, so any other field, such as `tenantId`, is rejected (FR-01).
 */
export const CourseChecksRequestSchema = z
  .strictObject({
    /** The candidate set: 1 to 12 distinct courses, checked together. */
    courseIds: z.array(CourseIdSchema).min(1).max(MAX_COURSE_CHECK_COURSES).readonly(),
    /**
     * Chosen credit values for variable-credit courses, at most one per course, each naming a
     * course in `courseIds`. Omitted or missing for a course means no value is chosen, which the
     * credit-load check reports as UNKNOWN, never as an assumed value.
     */
    creditSelections: z.array(CreditSelectionSchema).readonly().optional(),
  })
  .refine((body) => isDistinct(body.courseIds), {
    message: 'courseIds must not repeat a course',
    path: ['courseIds'],
  })
  // SAFETY: two values for one course would let the server pick which credits count.
  .refine(
    (body) => isDistinct((body.creditSelections ?? []).map((selection) => selection.courseId)),
    { message: 'creditSelections must not repeat a course', path: ['creditSelections'] },
  )
  .refine(
    (body) =>
      (body.creditSelections ?? []).every((selection) =>
        body.courseIds.includes(selection.courseId),
      ),
    { message: 'Each creditSelections course must be in courseIds', path: ['creditSelections'] },
  )
  .readonly();

/** Request body for `POST /v1/students/:studentId/course-checks`. */
export type CourseChecksRequest = z.infer<typeof CourseChecksRequestSchema>;

// ---- Response ----

/** Per-course results. Each dimension is shown separately; passing one implies nothing else. */
export const CourseCheckResultSchema = z
  .object({
    courseId: CourseIdSchema,
    /**
     * The PREREQUISITE check, or `null` when the course has no prerequisite rule. `null` means
     * "no rule" and is not a PASS: the UI shows that no rule was checked, never a passed check.
     */
    prerequisite: checkOfKind(CheckKind.Prerequisite).nullable(),
    /** The REQUIREMENT_APPLICABILITY check of the course against the audit. */
    applicability: checkOfKind(CheckKind.RequirementApplicability),
  })
  .readonly();

/** Checks of the candidate set as a whole. */
export const SetCheckResultsSchema = z
  .object({
    /** REQUIREMENT_ALLOCATION checks: one PASS, or one non-passing check per problem. */
    allocation: z.array(checkOfKind(CheckKind.RequirementAllocation)).min(1).readonly(),
    /** The CREDIT_LOAD check of the set's total against the term's approved bounds. */
    creditLoad: checkOfKind(CheckKind.CreditLoad),
  })
  .readonly();

/** The input revisions every result was computed from, so a result can be reproduced. */
export const PinnedInputsSchema = z
  .object({
    studentSnapshotId: StudentSnapshotIdSchema,
    /** Audit system of the pinned audit, for example `demo-audit`. */
    auditSource: z.string().min(1),
    /** The audit system's run or revision ID, for example `audit_demo_r7`. */
    auditVersion: z.string().min(1),
    /** Published ruleset version of the academic policy, for example `demo-2026.1`. */
    rulesetVersion: z.string().min(1),
  })
  .readonly();

/** The response fields the cross-field rules read. */
interface CourseChecksShape {
  readonly courseResults: readonly {
    readonly prerequisite: CheckResult | null;
    readonly applicability: CheckResult;
  }[];
  readonly setResults: {
    readonly allocation: readonly CheckResult[];
    readonly creditLoad: CheckResult;
  };
}

/**
 * Lists every check in a response. A `null` prerequisite is not a check and isn't listed.
 *
 * @param response - The response's course and set results.
 * @returns Every check result, per-course first.
 */
function allChecks(response: CourseChecksShape): readonly CheckResult[] {
  return [
    ...response.courseResults.flatMap(({ prerequisite, applicability }) =>
      prerequisite === null ? [applicability] : [prerequisite, applicability],
    ),
    ...response.setResults.allocation,
    response.setResults.creditLoad,
  ];
}

/** Response body for `POST /v1/students/:studentId/course-checks`. */
export const CourseChecksResponseSchema = z
  .object({
    /** One entry per requested course, in request order. */
    courseResults: z.array(CourseCheckResultSchema).min(1).max(MAX_COURSE_CHECK_COURSES).readonly(),
    setResults: SetCheckResultsSchema,
    /** Aggregate of every check, by the fixed precedence FAIL, UNKNOWN, CONDITIONAL, PASS. */
    aggregate: AggregateStateSchema,
    pinnedInputs: PinnedInputsSchema,
  })
  .refine((response) => isDistinct(response.courseResults.map((result) => result.courseId)), {
    message: 'courseResults must not repeat a course',
    path: ['courseResults'],
  })
  // SAFETY: VALIDATED claims every check passed; one non-passing check makes that claim false.
  .refine(
    (response) =>
      response.aggregate !== AggregateState.Validated ||
      allChecks(response).every((check) => check.state === CheckState.Pass),
    { message: 'VALIDATED requires every check to PASS', path: ['aggregate'] },
  )
  // SAFETY: a prerequisite evaluated under another ruleset isn't reproducible from the pinned
  // inputs, so it must not be shown beside them.
  .refine(
    (response) =>
      response.courseResults.every(
        ({ prerequisite }) =>
          prerequisite?.evidence === undefined ||
          prerequisite.evidence.rulesetVersion === response.pinnedInputs.rulesetVersion,
      ),
    {
      message: 'Prerequisite evidence must use the pinned rulesetVersion',
      path: ['courseResults'],
    },
  )
  .readonly();

/** Response body for `POST /v1/students/:studentId/course-checks`. */
export type CourseChecksResponse = z.infer<typeof CourseChecksResponseSchema>;

/**
 * Checks a candidate course set for one student the signed-in user may see. Others are
 * NOT_FOUND. Read-only: it registers nothing and writes nothing to an institutional system.
 */
export const checkCoursesEndpoint = defineEndpoint({
  method: 'POST',
  path: '/v1/students/:studentId/course-checks',
  response: CourseChecksResponseSchema,
});
