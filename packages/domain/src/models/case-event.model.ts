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
import { CaseIdSchema } from './advising-case.model';
import { UserIdSchema } from './user-identity.model';

/** Branded ID so a case event ID can never be passed where another ID is expected. */
export const CaseEventIdSchema = z.uuid().brand<'CaseEventId'>();

/** Unique identifier of a {@link CaseEvent}. */
export type CaseEventId = z.infer<typeof CaseEventIdSchema>;

/** Longest resolution note, in characters. */
export const CASE_EVENT_NOTE_MAX_LENGTH = 1000;

/**
 * Returns whether the first-event rule holds: only CREATE has no prior status, and only the first
 * event is CREATE. Shared by this model and the case view contract.
 *
 * @param event - The action, sequence and prior status of an event.
 * @returns `true` when the rule holds.
 */
export function isCaseEventOriginValid(event: {
  readonly action: CaseAction;
  readonly sequence: number;
  readonly fromStatus: string | null;
}): boolean {
  const isCreate = event.action === CaseAction.Create;
  return isCreate === (event.fromStatus === null) && isCreate === (event.sequence === 1);
}

/**
 * Returns whether a resolution and note appear only with RESOLVE: a resolution exactly on RESOLVE,
 * and a note on no other action. Shared by this model and the case request and view contracts.
 *
 * @param event - The action, resolution and note of an event or request.
 * @returns `true` when the resolution and note fit the action.
 */
export function isCaseResolutionPlacementValid(event: {
  readonly action: CaseAction;
  readonly resolution: string | null;
  readonly note: string | null;
}): boolean {
  const isResolve = event.action === CaseAction.Resolve;
  return isResolve === (event.resolution !== null) && (isResolve || event.note === null);
}

/** Schema for a case event. */
export const CaseEventSchema = z
  .object({
    id: CaseEventIdSchema,
    caseId: CaseIdSchema,
    /** Position in the case's history. 1 is the CREATE event. */
    sequence: z.number().int().min(1),
    action: CaseActionSchema,
    actorUserId: UserIdSchema,
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
  .refine((e) => isCaseEventOriginValid(e), {
    message: 'fromStatus is null and sequence is 1 exactly for CREATE',
    path: ['fromStatus'],
  })
  // SAFETY: a resolution is recorded only when the case is resolved, so it is never read as a waiver.
  .refine((e) => isCaseResolutionPlacementValid(e), {
    message: 'resolution is present exactly on RESOLVE, and a note only on RESOLVE',
    path: ['resolution'],
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
