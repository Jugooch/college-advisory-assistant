/**
 * @file Request bodies and query for the advisor case endpoints.
 * @module @caa/api-contract/contracts/case-requests
 * @requirement FR-01
 * @requirement FR-12
 * @requirement FR-17
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

import {
  CASE_EVENT_NOTE_MAX_LENGTH,
  CaseAction,
  CaseActionSchema,
  CaseReason,
  CaseReasonSchema,
  CaseResolutionSchema,
  CaseStatusSchema,
  DiscrepancySubjectSchema,
  PlanRevisionIdSchema,
  STUDENT_NOTE_MAX_LENGTH,
} from '@caa/domain';

/**
 * Request body for `POST /v1/students/:studentId/cases`.
 *
 * SECURITY: strict. The body names the reason, the plan revision, the disputed record kind and the
 * student's note only. Tenant, user, role, owner and status come from the session or the case
 * logic, so any of them in the body is rejected (FR-01). `planRevisionId` and
 * `discrepancySubject` are explicit `null` when not applicable.
 *
 * Errors: 404 when the student or revision is missing or not permitted; 409 `REVISION_CONFLICT`
 * when an open case already exists for the plan.
 */
export const CreateCaseRequestSchema = z
  .strictObject({
    reason: CaseReasonSchema,
    /** The saved plan revision to freeze into the case. `null` only for a source discrepancy. */
    planRevisionId: PlanRevisionIdSchema.nullable(),
    /** What is disputed. Set exactly for a source discrepancy, otherwise `null`. */
    discrepancySubject: DiscrepancySubjectSchema.nullable(),
    /** The student's note for the advisor, 1 to 500 characters. */
    studentNote: z.string().trim().min(1).max(STUDENT_NOTE_MAX_LENGTH),
  })
  // SAFETY: a plan review without a plan is unreviewable (ADR-0013 §6 Objects, FR-12).
  .refine((body) => body.reason === CaseReason.SourceDiscrepancy || body.planRevisionId !== null, {
    message: 'planRevisionId is required unless the reason is SOURCE_DISCREPANCY',
    path: ['planRevisionId'],
  })
  // SAFETY: a subject on another reason, or none on a discrepancy, would misroute the report
  // (ADR-0013 §6 Objects, FR-17).
  .refine(
    (body) => (body.reason === CaseReason.SourceDiscrepancy) === (body.discrepancySubject !== null),
    {
      message: 'discrepancySubject is present exactly when the reason is SOURCE_DISCREPANCY',
      path: ['discrepancySubject'],
    },
  )
  .readonly();

/** Request body for `POST /v1/students/:studentId/cases`. */
export type CreateCaseRequest = z.infer<typeof CreateCaseRequestSchema>;

/** Actions a request may name. CREATE only happens through the create endpoint. */
const EventActionSchema = CaseActionSchema.exclude(['Create']);

/**
 * Request body for `POST /v1/cases/:caseId/events`.
 *
 * SECURITY: strict. The actor is the session's user; tenant, user, role, owner and the target
 * status are never accepted (FR-01). Whether the actor may take the action now is decided by the
 * api's case logic, which refuses it with 400.
 *
 * Errors: 404 when the case is missing or not permitted; 409 `REVISION_CONFLICT` when
 * `expectedSequence` is stale; 400 for a transition the case logic refuses.
 */
export const CaseEventRequestSchema = z
  .strictObject({
    action: EventActionSchema,
    /** The `lastSequence` the caller saw. A different value is a race and gets 409. */
    expectedSequence: z.number().int().min(1),
    /** Required with RESOLVE, rejected otherwise. */
    resolution: CaseResolutionSchema.optional(),
    /** Optional with RESOLVE, up to 1,000 characters, rejected otherwise. Visible to the student. */
    note: z.string().trim().min(1).max(CASE_EVENT_NOTE_MAX_LENGTH).optional(),
  })
  // SAFETY: a resolution is recorded only when a case is resolved, so a note or resolution on
  // another action can never read as a waiver (ADR-0013 §6 What a resolution is, planning/08).
  .refine(
    (body) =>
      (body.action === CaseAction.Resolve) === (body.resolution !== undefined) &&
      (body.action === CaseAction.Resolve || body.note === undefined),
    {
      message: 'resolution is required on RESOLVE, and resolution and note are rejected otherwise',
      path: ['resolution'],
    },
  )
  .readonly();

/** Request body for `POST /v1/cases/:caseId/events`. */
export type CaseEventRequest = z.infer<typeof CaseEventRequestSchema>;

/**
 * Query for `GET /v1/advisor/cases`. Optional filters; tenant and the advisor's assignments come
 * from the session.
 *
 * `unrouted` is `true` or `false` (strictly parsed from the query string). `true` asks for the
 * admin-only view of open cases whose student has no active advisor assignment, so the student
 * always has a human route (ADR-0013 §6 Routing and the queue). The api answers 404 to an
 * advisor who sends it.
 */
export const CaseQueueQuerySchema = z
  .strictObject({
    status: CaseStatusSchema.optional(),
    unrouted: z.stringbool({ truthy: ['true'], falsy: ['false'] }).optional(),
  })
  .readonly();

/** Query for `GET /v1/advisor/cases`. */
export type CaseQueueQuery = z.infer<typeof CaseQueueQuerySchema>;
