/**
 * @file The chat panel's transcript model: stored turns from the API plus replies received in
 * this session, and the latest sequence the student has seen.
 * @module @caa/web/features/conversation/utils/chat-items
 * @requirement FR-10
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { AssistantTurnView, ConversationTurnView } from '@caa/api-contract';
import { TurnRole } from '@caa/domain';

/** One line of the transcript. */
export type ChatItem =
  | { readonly key: string; readonly kind: 'student'; readonly text: string }
  | {
      readonly key: string;
      readonly kind: 'stored';
      readonly turn: Extract<ConversationTurnView, { role: 'ASSISTANT' }>;
    }
  | { readonly key: string; readonly kind: 'live'; readonly turn: AssistantTurnView };

/**
 * Turns the API's stored turns into transcript items.
 *
 * @param turns - Stored turns in increasing sequence order.
 * @returns One item per turn.
 */
export function itemsFromTurns(turns: readonly ConversationTurnView[]): readonly ChatItem[] {
  return turns.map((turn): ChatItem => {
    const key = `stored-${String(turn.sequence)}`;
    return turn.role === TurnRole.Student
      ? { key, kind: 'student', text: turn.text }
      : { key, kind: 'stored', turn };
  });
}

/**
 * Reads the latest stored sequence, which the next turn must send as `expectedSequence`.
 *
 * @param turns - Stored turns in increasing sequence order.
 * @returns The last sequence, or 0 for an empty transcript.
 */
export function latestSequence(turns: readonly ConversationTurnView[]): number {
  return turns.at(-1)?.sequence ?? 0;
}
