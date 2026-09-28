/**
 * @file Contract for checking a candidate course set against the pinned record, audit, and rules.
 * The request body lives in `course-checks-request.contract.ts`.
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
  AggregateStateSchema,
  CheckKind,
  type CheckResult,
  CheckResultSchema,
  CheckState,
  CourseIdSchema,
  deriveAggregateState,
  StudentSnapshotIdSchema,
} from '@caa/domain';

import { defineEndpoint } from '../define-endpoint';
import { MAX_COURSE_CHECK_COURSES } from './course-checks-request.contract';

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

/** Per-course results. Each dimension is shown separately; passing one implies nothing else. */
export const CourseCheckResultSchema = z
  .object({
    courseId: CourseIdSchema,
    /**
     * The PREREQUISITE check, or `null` when the course has no prerequisite rule. `null` means
     * "no rule" and is not a PASS: the UI shows that no rule was checked, never a passed check.
     * A check that isn't UNKNOWN carries evidence, whose `rulesetVersion` is the pinned one.
     */
    prerequisite: checkOfKind(CheckKind.Prerequisite)
      // SAFETY: a PASS, FAIL, or CONDITIONAL prerequisite is a verdict under one ruleset; without
      // evidence it can't be tied to `pinnedInputs.rulesetVersion`, so it isn't reproducible.
      // An UNKNOWN claims no verdict, so it may come without evidence (for example when the
      // rule couldn't be loaded). See planning/08 §Rule lifecycle and §Evidence contract example.
      .refine((check) => check.state === CheckState.Unknown || check.evidence !== undefined, {
        message: 'A prerequisite check that is not UNKNOWN requires evidence',
        path: ['evidence'],
      })
      .nullable(),
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

/**
 * The input revisions every result was computed from, so a result can be reproduced, and the
 * source times they describe. Every result is valid only as of `studentRecordEffectiveAt` and
 * `auditRecordEffectiveAt`: a PASS may be shown only as "passed as of" those times, never as
 * current (planning/08 §Authority and result semantics).
 */
export const PinnedInputsSchema = z
  .object({
    studentSnapshotId: StudentSnapshotIdSchema,
    /**
     * The point in time the pinned student record describes: the snapshot's
     * `sourceEffectiveAt`. ISO 8601 with offset.
     */
    studentRecordEffectiveAt: z.iso.datetime({ offset: true }),
    /**
     * The point in time of the student record the pinned audit was run against: the audit's
     * `studentRecordEffectiveAt`. ISO 8601 with offset.
     */
    auditRecordEffectiveAt: z.iso.datetime({ offset: true }),
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
    /**
     * Aggregate of every check, by the fixed precedence FAIL, UNKNOWN, CONDITIONAL, PASS. A
     * `null` prerequisite is not a check, so it doesn't count.
     */
    aggregate: AggregateStateSchema,
    pinnedInputs: PinnedInputsSchema,
  })
  .refine((response) => isDistinct(response.courseResults.map((result) => result.courseId)), {
    message: 'courseResults must not repeat a course',
    path: ['courseResults'],
  })
  // SAFETY: the aggregate must follow from the checks it summarizes, so a FAIL is never shown
  // as conditional, an UNKNOWN never as conditional or validated, and a clean set never as
  // blocked (planning/08 §Authority and result semantics: aggregate precedence).
  .refine(
    (response) =>
      response.aggregate === deriveAggregateState(allChecks(response).map((check) => check.state)),
    {
      message: 'aggregate must follow the FAIL, UNKNOWN, CONDITIONAL, PASS precedence',
      path: ['aggregate'],
    },
  )
  // SAFETY: a prerequisite evaluated under another ruleset isn't reproducible from the pinned
  // inputs, so it must not be shown beside them (planning/08 §Rule lifecycle; planning/09
  // §Canonical entities: Validation is an immutable result for pinned inputs).
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
