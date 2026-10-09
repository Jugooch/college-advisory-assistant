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

import { postConversationTurn } from '@/api/conversation.api';
import { keepApiError } from '@/shared/utils/keep-api-error';

import { toFailureResult } from '../utils/action-failure';
import type { SendTurnResult } from '../utils/conversation-state';

/**
 * Sends the message, term, latest seen sequence and the form's confirmed inputs. Prior turns are
 * never sent: the server holds the transcript. This is one API call; on a revision conflict the
 * panel reloads the transcript through the reload action. Tenant and user come from the session
 * on the server.
 *
 * @param studentId - Internal student ID from the page URL.
 * @param request - The turn request; it is checked again here before anything is sent.
 * @returns The reply, `conflict` when the transcript changed, `rejected` when the request didn't
 *   parse, or the API's own error.
 */
export async function sendTurnAction(studentId: string, request: unknown): Promise<SendTurnResult> {
  const parsed = ConversationTurnRequestSchema.safeParse(request);
  if (!parsed.success) {
    return { kind: 'rejected' };
  }
  const reply = await keepApiError(postConversationTurn(studentId, parsed.data));
  if (reply instanceof ApiError) {
    return reply.code === ErrorCode.RevisionConflict
      ? { kind: 'conflict' }
      : toFailureResult(reply);
  }
  return { kind: 'replied', turn: reply.turn, lastSequence: reply.lastSequence };
}
