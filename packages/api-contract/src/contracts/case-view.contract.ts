/**
 * @file The case view: a case, its events with role-only actors, and the actions the session may take.
 * @module @caa/api-contract/contracts/case-view
 * @requirement FR-01
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-17
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

import {
  CASE_EVENT_NOTE_MAX_LENGTH,
  CaseAction,
  CaseActionSchema,
  CaseEventIdSchema,
  CaseIdSchema,
  CaseReasonSchema,
  CaseResolutionSchema,
  CaseStatus,
  CaseStatusSchema,
  DiscrepancySubjectSchema,
  hasMatchingDiscrepancySubject,
  hasRequiredPlanRevision,
  isCaseEventOriginValid,
  isCaseOwnerConsistent,
  isCaseResolutionPlacementValid,
  PlanRevisionIdSchema,
  RoleSchema,
  STUDENT_NOTE_MAX_LENGTH,
  StudentIdSchema,
} from '@caa/domain';

/**
 * One case event as the session may see it.
 *
 * SECURITY: strict, and the actor is a role plus `isYou`. No user ID or name appears, so no view
 * can expose another user (ADR-0013 §6 Frozen context, FR-14).
 */
export const CaseEventViewSchema = z
  .strictObject({
    id: CaseEventIdSchema,
    sequence: z.number().int().min(1),
    action: CaseActionSchema,
    /** The role the actor acted as. */
    actorRole: RoleSchema,
    /** Whether the signed-in user took this action. */
    isYou: z.boolean(),
    /** ISO 8601 with offset. */
    at: z.iso.datetime({ offset: true }),
    fromStatus: CaseStatusSchema.nullable(),
    toStatus: CaseStatusSchema,
    /** Present only on RESOLVE. Advice, not permission to enroll. */
    resolution: CaseResolutionSchema.nullable(),
    /** Present only on RESOLVE, up to 1,000 characters. */
    note: z.string().min(1).max(CASE_EVENT_NOTE_MAX_LENGTH).nullable(),
  })
  // SAFETY: only CREATE has no prior status, and only the first event is CREATE
  // (ADR-0013 §6 Objects).
  .refine((event) => isCaseEventOriginValid(event), {
    message: 'fromStatus is null and sequence is 1 exactly for CREATE',
    path: ['fromStatus'],
  })
  // SAFETY: a resolution and its note appear only on RESOLVE, so they are never read as a waiver
  // (ADR-0013 §6 What a resolution is, planning/08 §Rule lifecycle).
  .refine((event) => isCaseResolutionPlacementValid(event), {
    message: 'resolution is present exactly on RESOLVE, and a note only on RESOLVE',
    path: ['resolution'],
  })
  .readonly();

/** One case event as the session may see it. */
export type CaseEventView = z.infer<typeof CaseEventViewSchema>;

/**
 * Returns whether a list has no repeated values.
 *
 * @param values - Values to check.
 * @returns `true` when every value appears once.
 */
function hasNoRepeats(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/** Who owns a case: their role and whether it is the signed-in user. Never an ID or a name. */
const CaseOwnerViewSchema = z.strictObject({ role: RoleSchema, isYou: z.boolean() }).readonly();

/**
 * Response body for `GET /v1/cases/:caseId` and `POST /v1/cases/:caseId/events`.
 *
 * SECURITY: strict, with no tenant, owner ID or actor IDs. `allowedActions` is computed by the api
 * for the session's actor from its case logic; the contract only types and bounds it.
 */
export const CaseViewSchema = z
  .strictObject({
    id: CaseIdSchema,
    /** Opaque student ID. */
    studentId: StudentIdSchema,
    reason: CaseReasonSchema,
    /** The frozen plan revision under review. `null` only for a source discrepancy. */
    planRevisionId: PlanRevisionIdSchema.nullable(),
    discrepancySubject: DiscrepancySubjectSchema.nullable(),
    studentNote: z.string().min(1).max(STUDENT_NOTE_MAX_LENGTH),
    status: CaseStatusSchema,
    /** The claiming advisor or the resolver. `null` unless IN_REVIEW or RESOLVED. */
    owner: CaseOwnerViewSchema.nullable(),
    /** ISO 8601 with offset. */
    createdAt: z.iso.datetime({ offset: true }),
    /** Sequence of the latest event: send it back as `expectedSequence`. */
    lastSequence: z.number().int().min(1),
    /** The history, oldest first, starting with CREATE. */
    events: z.array(CaseEventViewSchema).min(1).readonly(),
    /** Actions the session's actor may take now. Empty once the case is final. */
    allowedActions: z.array(CaseActionSchema).readonly(),
  })
  // SAFETY: a plan review without a plan, or a discrepancy without a subject, is unreviewable
  // (ADR-0013 §6 Objects, FR-17).
  .refine(
    (view) =>
      hasRequiredPlanRevision(view.reason, view.planRevisionId) &&
      hasMatchingDiscrepancySubject(view.reason, view.discrepancySubject),
    {
      message: 'reason, planRevisionId and discrepancySubject do not fit together',
      path: ['reason'],
    },
  )
  // SAFETY: ownership must match status so no case is unowned in review or unattributed once
  // resolved (ADR-0013 §6 States and transitions).
  .refine((view) => isCaseOwnerConsistent(view.status, view.owner !== null), {
    message: 'owner is set exactly when the status is IN_REVIEW or RESOLVED',
    path: ['owner'],
  })
  // SAFETY: the history must be the append-only chain that produced the status: sequences 1..n,
  // each event starting from the previous event's status, and the last event ending at `status`
  // with `lastSequence` (ADR-0013 §6 Concurrency).
  .refine(
    (view) =>
      view.events.every(
        (event, index) =>
          event.sequence === index + 1 &&
          event.fromStatus === (index === 0 ? null : view.events[index - 1]?.toStatus),
      ) &&
      view.events[view.events.length - 1]?.toStatus === view.status &&
      view.events[view.events.length - 1]?.sequence === view.lastSequence,
    {
      message: 'events must be a consecutive chain ending at status and lastSequence',
      path: ['events'],
    },
  )
  // SAFETY: CREATE is never an action the actor can take on an existing case, nothing is allowed
  // on a final case, and an action is listed once (ADR-0013 §6 States and transitions).
  .refine(
    (view) =>
      hasNoRepeats(view.allowedActions) &&
      !view.allowedActions.includes(CaseAction.Create) &&
      (view.allowedActions.length === 0 ||
        (view.status !== CaseStatus.Resolved && view.status !== CaseStatus.Withdrawn)),
    {
      message: 'allowedActions must be distinct, exclude CREATE, and be empty when final',
      path: ['allowedActions'],
    },
  )
  .readonly();

/** Response body for `GET /v1/cases/:caseId` and `POST /v1/cases/:caseId/events`. */
export type CaseView = z.infer<typeof CaseViewSchema>;
