/**
 * @file Decides, once, whether the chat panel renders: only when the transcript loaded.
 * @module @caa/web/features/conversation/utils/has-chat-panel
 * @requirement NFR-02
 */
import { ApiError, type ConversationResponse } from '@caa/api-contract';

/**
 * Tells whether the page loaded a conversation the panel can show.
 *
 * @param conversation - The API's answer, its error, or null when no valid term is chosen.
 * @returns True when the answer is a conversation, not an error or null.
 */
export function hasChatPanel(
  conversation: ConversationResponse | ApiError | null,
): conversation is ConversationResponse {
  return conversation !== null && !(conversation instanceof ApiError);
}
