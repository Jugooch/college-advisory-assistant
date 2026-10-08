/**
 * @file Contracts for the conversation: read the transcript, post one turn, and clear it.
 * @module @caa/api-contract/contracts/conversation
 * @requirement FR-08
 * @requirement FR-10
 * @requirement FR-01
 * @requirement FR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (sections 2, 3, 7 and 10)
 */
import { z } from 'zod';

import {
  ASSISTANT_TURN_MAX_LENGTH,
  AssistantBlockRefSchema,
  MAX_TURN_BLOCKS,
  ModelStatus,
  ModelStatusSchema,
  NoticeCode,
  StoredModelStatusSchema,
  STUDENT_TURN_MAX_LENGTH,
  TermIdSchema,
  TurnRole,
} from '@caa/domain';

import { defineEndpoint } from '../define-endpoint';
import { AssistantBlockSchema } from './conversation-blocks.contract';
import { ScheduleOptionsRequestSchema } from './schedule-options-request.contract';

/** Most turns the transcript returns: the newest (ADR-0015 §7). */
export const MAX_TRANSCRIPT_TURNS = 100;

/**
 * Query for reading or clearing a conversation. Strict: tenant, user and student come from the
 * session and path, never the query.
 */
export const ConversationQuerySchema = z.strictObject({ termId: TermIdSchema }).readonly();

/** Query for `GET` and `DELETE /v1/students/:studentId/conversation`. */
export type ConversationQuery = z.infer<typeof ConversationQuerySchema>;

/**
 * Request body for `POST /v1/students/:studentId/conversation/turns`.
 *
 * SECURITY: strict. The body holds the term, the student's message, the planner form's confirmed
 * state and the last sequence seen. Tenant, user, role, and any prior `turns` or `assistant`
 * history are rejected, because identity comes from the session and the server keeps history
 * (ADR-0015 §2 and §7, FR-01).
 */
export const ConversationTurnRequestSchema = z
  .strictObject({
    termId: TermIdSchema,
    /** The student's text, 1 to 1,000 characters after trimming. */
    message: z.string().trim().min(1).max(STUDENT_TURN_MAX_LENGTH),
    /** The planner form's current confirmed state, or absent when the form is empty. */
    plannerInputs: ScheduleOptionsRequestSchema.optional(),
    /** Sequence of the last turn the client saw, `0` for an empty transcript. */
    expectedSequence: z.number().int().min(0),
  })
  // SAFETY: form inputs for another term would let a turn schedule a term the student did not
  // choose (ADR-0015 §2, FR-01).
  .refine((body) => body.plannerInputs === undefined || body.plannerInputs.termId === body.termId, {
    message: 'plannerInputs.termId must equal termId',
    path: ['plannerInputs', 'termId'],
  })
  .readonly();

/** Request body for `POST /v1/students/:studentId/conversation/turns`. */
export type ConversationTurnRequest = z.infer<typeof ConversationTurnRequestSchema>;

/** The statuses for which the server stores no turn (ADR-0015 §2). */
const UNSTORED_STATUSES: readonly ModelStatus[] = [ModelStatus.RateLimited, ModelStatus.Disabled];

/**
 * The assistant's answer to one turn: an intro and verified blocks.
 *
 * `intro` is a server-written template, empty for a tier-1 crisis turn, at most 600
 * characters. It is not guarded model text. `sequence` is the
 * stored turn's position, or `null` when the status stored nothing.
 */
export const AssistantTurnViewSchema = z
  .strictObject({
    sequence: z.number().int().min(1).nullable(),
    intro: z.string().max(ASSISTANT_TURN_MAX_LENGTH),
    modelStatus: ModelStatusSchema,
    blocks: z.array(AssistantBlockSchema).max(MAX_TURN_BLOCKS).readonly(),
  })
  // SAFETY: RATE_LIMITED and DISABLED store nothing, so they have no sequence, and a stored
  // status always has one for the client's next `expectedSequence` (ADR-0015 §2, AC44).
  .refine((turn) => (turn.sequence === null) === UNSTORED_STATUSES.includes(turn.modelStatus), {
    message: 'sequence is null exactly for RATE_LIMITED and DISABLED',
    path: ['sequence'],
  })
  .readonly();

/** The assistant's answer to one turn. */
export type AssistantTurnView = z.infer<typeof AssistantTurnViewSchema>;

/** Response body for `POST /v1/students/:studentId/conversation/turns`. */
export const ConversationTurnResponseSchema = z
  .strictObject({
    turn: AssistantTurnViewSchema,
    /**
     * The conversation's last stored sequence. When present, the client must use it as the next
     * `expectedSequence`, because clear and unreadable turns leave it ahead of the visible
     * transcript (ADR-0015 §2, AC44).
     */
    lastSequence: z.number().int().min(0).optional(),
  })
  .readonly();

/** Response body for `POST /v1/students/:studentId/conversation/turns`. */
export type ConversationTurnResponse = z.infer<typeof ConversationTurnResponseSchema>;

/** Fields every stored turn view has. */
const HISTORY_FIELDS = {
  sequence: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
};

/**
 * One stored turn as the transcript shows it, discriminated by `role`. An assistant turn keeps
 * block references only: a past schedule or plan block has `shownAt` and no result, so a stored
 * PASS is never shown as current (ADR-0015 §7, ADR-0013 §3). Turn IDs, conversation IDs and
 * generation metadata stay on the server.
 */
export const ConversationTurnViewSchema = z.discriminatedUnion('role', [
  z
    .strictObject({
      ...HISTORY_FIELDS,
      role: z.literal(TurnRole.Student),
      text: z.string().min(1).max(STUDENT_TURN_MAX_LENGTH),
    })
    .readonly(),
  z
    .strictObject({
      ...HISTORY_FIELDS,
      role: z.literal(TurnRole.Assistant),
      intro: z.string().max(ASSISTANT_TURN_MAX_LENGTH),
      modelStatus: StoredModelStatusSchema,
      blockRefs: z.array(AssistantBlockRefSchema).max(MAX_TURN_BLOCKS).readonly(),
    })
    .readonly(),
]);

/** One stored turn as the transcript shows it. */
export type ConversationTurnView = z.infer<typeof ConversationTurnViewSchema>;

/**
 * Response body for `GET /v1/students/:studentId/conversation`.
 *
 * `available` is `false` when chat is off; `unavailableReason` then says why. The page still
 * works without chat (ADR-0015 §9).
 */
export const ConversationResponseSchema = z
  .strictObject({
    available: z.boolean(),
    unavailableReason: z.literal(NoticeCode.Disabled).nullable(),
    /** The newest 100 turns, oldest first. */
    turns: z.array(ConversationTurnViewSchema).max(MAX_TRANSCRIPT_TURNS).readonly(),
    /**
     * The conversation's last stored sequence. When present, the client must use it as the next
     * `expectedSequence`, because clear and unreadable turns leave it ahead of the visible
     * transcript (ADR-0015 §2, AC44).
     */
    lastSequence: z.number().int().min(0).optional(),
  })
  // SAFETY: an unavailable conversation always says why, and an available one never does, so
  // the UI can't show a disabled panel without a reason or a stale reason on a working one
  // (ADR-0015 §9, AC44).
  .refine((body) => body.available === (body.unavailableReason === null), {
    message: 'unavailableReason is null exactly when available',
    path: ['unavailableReason'],
  })
  // SAFETY: the transcript is append-only and ordered, so a repeated or reversed sequence means
  // the history is wrong (ADR-0015 §7).
  .refine(
    (body) =>
      body.turns.every((turn, i) => i === 0 || turn.sequence > (body.turns[i - 1]?.sequence ?? 0)),
    {
      message: 'turns must be in increasing sequence order',
      path: ['turns'],
    },
  )
  .readonly();

/** Response body for `GET /v1/students/:studentId/conversation`. */
export type ConversationResponse = z.infer<typeof ConversationResponseSchema>;

/**
 * Reads the signed-in student's transcript for a term: availability and the newest 100 turns.
 * Query: `ConversationQuerySchema`. Errors: 400 for a bad query; 404 for anyone but the student.
 */
export const getConversationEndpoint = defineEndpoint({
  method: 'GET',
  path: '/v1/students/:studentId/conversation',
  query: ConversationQuerySchema,
  response: ConversationResponseSchema,
});

/**
 * Posts one student message and returns the assistant's answer. Always 200 with a `modelStatus`
 * when the request is valid, even if the model is off or down (ADR-0015 §2). Body:
 * `ConversationTurnRequestSchema`. Errors: 400 for a bad body; 404 for anyone but the student;
 * 409 `REVISION_CONFLICT` when `expectedSequence` is not the latest.
 */
export const postConversationTurnEndpoint = defineEndpoint({
  method: 'POST',
  path: '/v1/students/:studentId/conversation/turns',
  response: ConversationTurnResponseSchema,
});

/**
 * Clears the student's transcript for a term. Responds 204 with no body. Query:
 * `ConversationQuerySchema`. Errors: 400 for a bad query; 404 for anyone but the student.
 */
export const clearConversationEndpoint = defineEndpoint({
  method: 'DELETE',
  path: '/v1/students/:studentId/conversation',
  query: ConversationQuerySchema,
  response: z.undefined(),
});
