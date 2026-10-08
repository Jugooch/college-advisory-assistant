/**
 * @file Server action: posts one student message to the conversation and returns the reply.
 * @module @caa/web/features/conversation/actions/send-turn
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
'use server';

import { ApiError, ConversationTurnRequestSchema } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';

import { getConversation, postConversationTurn } from '@/api/conversation.api';
import { keepApiError } from '@/shared/utils/keep-api-error';

import { type SendTurnResult, toFailure } from '../utils/conversation-state';

/**
 * Sends the message, term, latest seen sequence and the form's confirmed inputs. Prior turns are
 * never sent: the server holds the transcript. On 409 it reloads the transcript so the panel can
 * show what changed. Tenant and user come from the session on the server.
 *
 * @param studentId - Internal student ID from the page URL.
 * @param request - The turn request; it is checked again here before anything is sent.
 * @returns The reply, the reloaded transcript on a conflict, `rejected` when the request didn't
 *   parse, or the API's own error.
 */
export async function sendTurnAction(studentId: string, request: unknown): Promise<SendTurnResult> {
  const parsed = ConversationTurnRequestSchema.safeParse(request);
  if (!parsed.success) {
    return { kind: 'rejected' };
  }
  const reply = await keepApiError(postConversationTurn(studentId, parsed.data));
  if (!(reply instanceof ApiError)) {
    return { kind: 'replied', turn: reply.turn };
  }
  if (reply.code !== ErrorCode.RevisionConflict) {
    return toFailure(reply);
  }
  const conversation = await keepApiError(
    getConversation(studentId, { termId: parsed.data.termId }),
  );
  return conversation instanceof ApiError
    ? toFailure(conversation)
    : { kind: 'conflict', conversation };
}
