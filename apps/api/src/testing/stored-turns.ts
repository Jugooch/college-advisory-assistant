/**
 * @file Builds stored conversation turns for API tests, with the identifiers parsed rather than
 * cast. Test code only.
 * @module @caa/api/testing/stored-turns
 */
import type { StoredConversationTurn } from '@caa/db';
import { ConversationIdSchema, ConversationTurnIdSchema, ModelStatus, TurnRole } from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

/** The instant stored turns are created at by default. */
export const STORED_TURN_AT = '2026-09-01T12:00:00.000Z';

/**
 * Builds a stored turn: a student turn has no references, status or metadata, and an assistant
 * turn is ANSWERED with none.
 *
 * @param sequence - The turn's sequence; drives its id and default text.
 * @param role - Who wrote the turn.
 * @param overrides - Fields to replace in the default.
 * @returns A stored turn.
 */
export function buildStoredTurn(
  sequence: number,
  role: TurnRole,
  overrides: Partial<StoredConversationTurn> = {},
): StoredConversationTurn {
  const isAssistant = role === TurnRole.Assistant;
  return {
    id: ConversationTurnIdSchema.parse(syntheticId('conversationTurn', sequence)),
    conversationId: ConversationIdSchema.parse(syntheticId('conversation', 1)),
    sequence,
    role,
    text: `${role} ${String(sequence)}`,
    blockRefs: isAssistant ? [] : null,
    modelStatus: isAssistant ? ModelStatus.Answered : null,
    metadata: null,
    createdAt: STORED_TURN_AT,
    ...overrides,
  };
}
