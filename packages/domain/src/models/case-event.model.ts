/**
 * @file Case event data object: one append-only change to an advising case.
 * @module @caa/domain/models/case-event
 * @requirement FR-12, FR-14
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

import { CaseAction, CaseActionSchema } from '../enums/case-action.enum';
import { CaseResolutionSchema } from '../enums/case-resolution.enum';
import { CaseStatusSchema } from '../enums/case-status.enum';
import { RoleSchema } from '../enums/role.enum';
import { CaseIdSchema } from './advising-case.model';
import { UserIdSchema } from './user-identity.model';

/** Branded ID so a case event ID can never be passed where another ID is expected. */
export const CaseEventIdSchema = z.uuid().brand<'CaseEventId'>();

/** Unique identifier of a {@link CaseEvent}. */
export type CaseEventId = z.infer<typeof CaseEventIdSchema>;

/** Longest resolution note, in characters. */
export const CASE_EVENT_NOTE_MAX_LENGTH = 1000;

/** Schema for a case event. */
export const CaseEventSchema = z
  .object({
    id: CaseEventIdSchema,
    caseId: CaseIdSchema,
    /** Position in the case's history. 1 is the CREATE event. */
    sequence: z.number().int().min(1),
    action: CaseActionSchema,
    actorUserId: UserIdSchema,
    /** Role the actor held when acting (ADR-0013 Amendment 1). */
    // TODO(#449): make required once all writers set it.
    actorRole: RoleSchema.optional(),
    /** ISO 8601 with offset. */
    at: z.iso.datetime({ offset: true }),
    /** Status before the action. `null` only for CREATE. */
    fromStatus: CaseStatusSchema.nullable(),
    toStatus: CaseStatusSchema,
    /** Present only on RESOLVE. */
    resolution: CaseResolutionSchema.nullable(),
    /** Present only on RESOLVE. */
    note: z.string().trim().min(1).max(CASE_EVENT_NOTE_MAX_LENGTH).nullable(),
  })
  // SAFETY: only CREATE has no prior status, and only the first event is CREATE.
  .refine(
    (e) =>
      (e.action === CaseAction.Create) === (e.fromStatus === null) &&
      (e.action === CaseAction.Create) === (e.sequence === 1),
    { message: 'fromStatus is null and sequence is 1 exactly for CREATE', path: ['fromStatus'] },
  )
  // SAFETY: a resolution is recorded only when the case is resolved, so it is never read as a waiver.
  .refine((e) => (e.action === CaseAction.Resolve) === (e.resolution !== null), {
    message: 'resolution is present exactly on RESOLVE',
    path: ['resolution'],
  })
  .refine((e) => e.action === CaseAction.Resolve || e.note === null, {
    message: 'note is allowed only on RESOLVE',
    path: ['note'],
  })
  .readonly();

/** A validated, immutable case event. */
export type CaseEvent = z.infer<typeof CaseEventSchema>;

/** Raw input accepted by {@link createCaseEvent}. */
export type CaseEventInput = z.input<typeof CaseEventSchema>;

/**
 * Creates a validated, immutable case event.
 *
 * @param input - Raw event fields.
 * @returns The parsed event.
 * @throws {z.ZodError} When a field or a cross-field rule is violated.
 */
export function createCaseEvent(input: CaseEventInput): CaseEvent {
  return CaseEventSchema.parse(input);
}
