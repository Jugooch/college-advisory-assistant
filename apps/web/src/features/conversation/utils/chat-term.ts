/**
 * @file Reads the planner's term text as a term ID for the chat panel.
 * @module @caa/web/features/conversation/utils/chat-term
 * @requirement FR-10
 */
import { type TermId, TermIdSchema } from '@caa/domain';

/**
 * Parses the term the planner form carries.
 *
 * @param text - The term text from the page's query.
 * @returns The term ID, or `null` when no valid term is chosen yet.
 */
export function readChatTerm(text: string): TermId | null {
  const parsed = TermIdSchema.safeParse(text);
  return parsed.success ? parsed.data : null;
}
