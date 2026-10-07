/**
 * @file Contracts for the advisor case endpoints: create, list, read, the advisor queue, and events.
 * @module @caa/api-contract/contracts/cases
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-17
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

import {
  CaseIdSchema,
  CaseReasonSchema,
  CaseStatusSchema,
  DiscrepancySubjectSchema,
  PlanRevisionIdSchema,
  StudentIdSchema,
} from '@caa/domain';

import { defineEndpoint } from '../define-endpoint';
import { CaseViewSchema } from './case-view.contract';

/**
 * One row of the student's own case list. No note text.
 *
 * SECURITY: strict, so a row can never carry an owner ID or another user's data.
 */
export const CaseSummarySchema = z
  .strictObject({
    id: CaseIdSchema,
    reason: CaseReasonSchema,
    planRevisionId: PlanRevisionIdSchema.nullable(),
    discrepancySubject: DiscrepancySubjectSchema.nullable(),
    status: CaseStatusSchema,
    /** ISO 8601 with offset. */
    createdAt: z.iso.datetime({ offset: true }),
  })
  .readonly();

/**
 * One row of the advisor or admin queue.
 *
 * SECURITY: data minimization (FR-14). An opaque student ID and the case facts only: no note
 * text, no owner ID, no student name.
 */
export const CaseQueueItemSchema = z
  .strictObject({
    caseId: CaseIdSchema,
    studentId: StudentIdSchema,
    reason: CaseReasonSchema,
    status: CaseStatusSchema,
    /** ISO 8601 with offset. */
    createdAt: z.iso.datetime({ offset: true }),
    /** Whether the signed-in user owns the case. */
    ownerIsYou: z.boolean(),
    /**
     * `false` when the student has no active advisor assignment. Only admins see such rows
     * (ADR-0013 §6 Routing and the queue).
     */
    routed: z.boolean(),
  })
  .readonly();

/**
 * Returns whether instants are in order. Comparing parsed instants is needed because offsets differ.
 *
 * @param times - ISO 8601 strings with offset.
 * @param direction - `1` for oldest first, `-1` for newest first.
 * @returns `true` when each instant is not before (or not after) the previous one.
 */
function isOrderedByTime(times: readonly string[], direction: 1 | -1): boolean {
  return times.every(
    (time, index) =>
      index === 0 || (Date.parse(time) - Date.parse(times[index - 1] ?? time)) * direction >= 0,
  );
}

/** Response body for `GET /v1/students/:studentId/cases`: newest first. */
export const CaseListResponseSchema = z
  .strictObject({ cases: z.array(CaseSummarySchema).readonly() })
  // SAFETY: the list is the student's history, newest first (ADR-0013 §7); a different order
  // would make the top row look like the current case.
  .refine(
    (body) =>
      isOrderedByTime(
        body.cases.map((row) => row.createdAt),
        -1,
      ),
    {
      message: 'cases must be newest first',
      path: ['cases'],
    },
  )
  .readonly();

/** Response body for `GET /v1/students/:studentId/cases`. */
export type CaseListResponse = z.infer<typeof CaseListResponseSchema>;

/** Response body for `GET /v1/advisor/cases`: oldest first. */
export const CaseQueueResponseSchema = z
  .strictObject({ cases: z.array(CaseQueueItemSchema).readonly() })
  // SAFETY: the queue is worked oldest first so no student waits behind newer cases
  // (ADR-0013 §7, FR-12).
  .refine(
    (body) =>
      isOrderedByTime(
        body.cases.map((row) => row.createdAt),
        1,
      ),
    {
      message: 'cases must be oldest first',
      path: ['cases'],
    },
  )
  .readonly();

/** Response body for `GET /v1/advisor/cases`. */
export type CaseQueueResponse = z.infer<typeof CaseQueueResponseSchema>;

/**
 * Creates a case for a student (the student only). Body: `CreateCaseRequestSchema`; 201 returns
 * the case view. Errors: 404 not found or not permitted; 409 `REVISION_CONFLICT` when an open case
 * already exists for the plan. App-internal: nothing is sent outside the app.
 */
export const createCaseEndpoint = defineEndpoint({
  method: 'POST',
  path: '/v1/students/:studentId/cases',
  response: CaseViewSchema,
});

/** Lists the student's cases, newest first. Others' students are NOT_FOUND. */
export const listStudentCasesEndpoint = defineEndpoint({
  method: 'GET',
  path: '/v1/students/:studentId/cases',
  response: CaseListResponseSchema,
});

/** Reads one case with its events. Missing and not-permitted cases are both NOT_FOUND. */
export const getCaseEndpoint = defineEndpoint({
  method: 'GET',
  path: '/v1/cases/:caseId',
  response: CaseViewSchema,
});

/**
 * Lists the advisor or admin queue, oldest first. Query: `CaseQueueQuerySchema`. The `unrouted`
 * filter and `routed: false` rows are admin-only.
 */
export const listAdvisorCasesEndpoint = defineEndpoint({
  method: 'GET',
  path: '/v1/advisor/cases',
  response: CaseQueueResponseSchema,
});

/**
 * Takes one action on a case. Body: `CaseEventRequestSchema`; 201 returns the updated case view.
 * Errors: 404 not found or not permitted; 409 `REVISION_CONFLICT` for a sequence race; 400 for a
 * transition the api's case logic refuses.
 */
export const addCaseEventEndpoint = defineEndpoint({
  method: 'POST',
  path: '/v1/cases/:caseId/events',
  response: CaseViewSchema,
});
