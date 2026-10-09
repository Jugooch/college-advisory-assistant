/**
 * @file Pure rules for the history the model sees: the student's messages and the server's
 * intros from the newest stored turns, never model text, tool results or blocks, and never a
 * tier-1 crisis exchange.
 * @module @caa/api/modules/conversation-history/conversation-history.logic
 * @requirement FR-10
 * @requirement FR-14
 * @requirement AC46
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (sections 3 and 7)
 */
import type { StoredConversationTurn } from '@caa/db';
import { AssistantTurnMetadataSchema, TurnRole } from '@caa/domain';

/** A message in the model's history: a student message or a server-written intro. */
export type HistoryMessage =
  | { readonly role: 'user'; readonly text: string }
  | { readonly role: 'assistant'; readonly text: string; readonly toolCalls: readonly never[] };

/**
 * Tells whether a stored assistant turn is a tier-1 crisis answer. A turn whose metadata can't
 * be read counts as one, so it is left out of the history rather than guessed at.
 *
 * @param turn - A stored assistant turn.
 * @param crisisReason - The guard reason recorded for tier-1 crisis language.
 * @returns `true` when the turn must not be replayed to the model.
 */
function isCrisisAnswer(turn: StoredConversationTurn, crisisReason: string): boolean {
  const metadata = AssistantTurnMetadataSchema.safeParse(turn.metadata);
  return !metadata.success || metadata.data.guardReasons.includes(crisisReason);
}

/**
 * Builds the model's history: the student's messages and the server's intros, never model
 * text, tool results or blocks, and never a tier-1 crisis exchange.
 *
 * @param stored - The newest stored turns, oldest first.
 * @param limit - Most turns to send (`CONVERSATION_HISTORY_TURNS`).
 * @param crisisReason - The guard reason recorded for tier-1 crisis language.
 * @returns Messages starting with a student message.
 */
export function buildHistory(
  stored: readonly StoredConversationTurn[],
  limit: number,
  crisisReason: string,
): readonly HistoryMessage[] {
  const omitted = new Set<number>();
  for (const turn of stored) {
    if (turn.role === TurnRole.Assistant && isCrisisAnswer(turn, crisisReason)) {
      // NOTE: turns are appended in pairs, so the question is the turn before the answer.
      omitted.add(turn.sequence).add(turn.sequence - 1);
    }
  }
  const eligible = stored.filter((turn) => !omitted.has(turn.sequence));
  // NOTE: slice(-0) would keep everything, so the start index is computed.
  const kept = eligible.slice(Math.max(eligible.length - Math.max(limit, 0), 0));
  const first = kept.findIndex((turn) => turn.role === TurnRole.Student);
  return (first < 0 ? [] : kept.slice(first)).map((turn): HistoryMessage =>
    turn.role === TurnRole.Student
      ? { role: 'user', text: turn.text }
      : { role: 'assistant', text: turn.text, toolCalls: [] },
  );
}
