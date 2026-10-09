/**
 * @file API calls for the student's conversation: read the transcript, post a turn, clear it.
 * @module @caa/web/api/conversation
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import {
  clearConversationEndpoint,
  type ConversationQuery,
  type ConversationResponse,
  type ConversationTurnRequest,
  type ConversationTurnResponse,
  getConversationEndpoint,
  postConversationTurnEndpoint,
} from '@caa/api-contract';

import { apiClient } from '@/lib/api-client';

/**
 * Reads the student's transcript for a term and whether chat is available.
 *
 * @param studentId - Internal student ID from the page URL. The API allows only the session's own.
 * @param query - The term to read.
 * @returns The availability and the stored turns, exactly as the API returned them.
 * @throws {ApiError} When the API responds with an error envelope.
 */
export async function getConversation(
  studentId: string,
  query: ConversationQuery,
): Promise<ConversationResponse> {
  return apiClient.call(getConversationEndpoint, { params: { studentId }, query });
}

/**
 * Posts one student message. The request carries the message, the term, the latest sequence the
 * student has seen, and the form's confirmed inputs, never earlier turns.
 *
 * @param studentId - Internal student ID from the page URL.
 * @param request - The turn request.
 * @returns The assistant's turn with its status and blocks.
 * @throws {ApiError} When the API responds with an error envelope, such as 409 `REVISION_CONFLICT`.
 */
export async function postConversationTurn(
  studentId: string,
  request: ConversationTurnRequest,
): Promise<ConversationTurnResponse> {
  return apiClient.call(postConversationTurnEndpoint, { params: { studentId }, body: request });
}

/**
 * Clears the student's transcript for a term.
 *
 * @param studentId - Internal student ID from the page URL.
 * @param query - The term to clear.
 * @throws {ApiError} When the API responds with an error envelope.
 */
export async function clearConversation(
  studentId: string,
  query: ConversationQuery,
): Promise<void> {
  await apiClient.call(clearConversationEndpoint, { params: { studentId }, query });
}
