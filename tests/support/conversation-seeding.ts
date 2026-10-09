/**
 * @file Seeds and inspects stored conversation turns in the harness world, for the cases that
 * check retention. Turns are built with the test-kit builders and stored without model fields
 * the cases do not read.
 * @module @caa/tests/support/conversation-seeding
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { StoredConversationTurn } from '@caa/db';
import {
  buildAssistantTurn,
  buildConversation,
  buildStudentTurn,
  syntheticId,
} from '@caa/test-kit';

import type { AcceptanceWorld } from './api-harness';

/**
 * Gives a built turn the stored shape.
 *
 * @param turn - A built student or assistant turn.
 * @returns The stored turn.
 */
function stored(turn: ReturnType<typeof buildStudentTurn>): StoredConversationTurn {
  return turn.role === 'STUDENT'
    ? { ...turn, blockRefs: null, modelStatus: null, metadata: null }
    : { ...turn };
}

/**
 * Seeds the student's conversation with one question-and-answer pair per entry.
 *
 * @param world - The harness world.
 * @param createdAts - When each pair was stored; pair `n` has sequences `2n+1` and `2n+2`.
 */
export function seedPairs(world: AcceptanceWorld, createdAts: readonly string[]): void {
  world.conversations = [buildConversation()];
  world.conversationTurns = createdAts.flatMap((createdAt, index) => [
    stored(buildStudentTurn({ sequence: 2 * index + 1, createdAt }, 2 * index + 1)),
    stored(buildAssistantTurn({ sequence: 2 * index + 2, createdAt }, 2 * index + 2)),
  ]);
  world.conversationLastSequences = { [syntheticId('conversation', 1)]: createdAts.length * 2 };
}

/**
 * Lists the stored sequences of the world's conversations.
 *
 * @param world - The harness world.
 * @returns The sequences in increasing order.
 */
export function storedSequences(world: AcceptanceWorld): number[] {
  return (world.conversationTurns ?? []).map((turn) => turn.sequence).sort((a, b) => a - b);
}
