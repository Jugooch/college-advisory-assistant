/**
 * @file In-memory fake of the conversation repository for API tests, with the same tenant and
 * owner filter as PostgreSQL, and a student turn log that clearing does not shrink. Test code
 * only; never wired by the container.
 * @module @caa/api/testing/in-memory-conversation-repositories
 * @see docs/standards/07-testing.md
 */
import type {
  AppendTurnsRequest,
  AppendTurnsResult,
  ConversationRepository,
  StoredConversationTurn,
} from '@caa/db';
import {
  type Conversation,
  ConversationTurnIdSchema,
  createConversation,
  TurnRole,
} from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

/** One student turn in the rate-limit log. */
export interface InMemoryStudentTurnLogEntry {
  readonly tenantId: string;
  readonly studentId: string;
  readonly createdAt: string;
}

/** Conversation backing data. Every field omitted means none stored. */
export interface InMemoryConversationStore {
  conversations?: readonly Conversation[];
  conversationTurns?: readonly StoredConversationTurn[];
  studentTurnLog?: readonly InMemoryStudentTurnLogEntry[];
}

/**
 * Appends turns when the caller saw the last sequence, and logs each student turn.
 *
 * @param store - Backing data.
 * @param request - The append request.
 * @returns The append result.
 */
function append(store: InMemoryConversationStore, request: AppendTurnsRequest): AppendTurnsResult {
  const turns = (store.conversationTurns ?? []).filter(
    (turn) => turn.conversationId === request.conversationId,
  );
  const isOwned = (store.conversations ?? []).some(
    (entry) =>
      entry.id === request.conversationId &&
      entry.tenantId === request.tenantId &&
      entry.studentId === request.studentId,
  );
  if (!isOwned) {
    return { status: 'CONVERSATION_NOT_FOUND' };
  }
  const last = Math.max(0, ...turns.map((turn) => turn.sequence));
  if (last !== request.expectedSequence) {
    return { status: 'SEQUENCE_CONFLICT' };
  }
  const base = (store.conversationTurns ?? []).length;
  const stored = request.turns.map((turn, index): StoredConversationTurn => {
    const common = {
      id: ConversationTurnIdSchema.parse(syntheticId('conversationTurn', base + index + 1)),
      conversationId: request.conversationId,
      sequence: last + index + 1,
      role: turn.role,
      text: turn.text,
      createdAt: turn.createdAt,
    };
    return turn.role === TurnRole.Assistant
      ? {
          ...common,
          blockRefs: [...turn.blockRefs],
          modelStatus: turn.modelStatus,
          metadata: turn.metadata,
        }
      : { ...common, blockRefs: null, modelStatus: null, metadata: null };
  });
  store.conversationTurns = [...(store.conversationTurns ?? []), ...stored];
  store.studentTurnLog = [
    ...(store.studentTurnLog ?? []),
    ...request.turns
      .filter((turn) => turn.role === TurnRole.Student)
      .map((turn) => ({
        tenantId: request.tenantId,
        studentId: request.studentId,
        createdAt: turn.createdAt,
      })),
  ];
  return { status: 'APPENDED', turns: stored };
}

/**
 * Creates the conversation repository over an in-memory store.
 *
 * @param store - Backing data. Read on every call.
 * @returns A {@link ConversationRepository}.
 */
export function createInMemoryConversationRepository(
  store: InMemoryConversationStore,
): ConversationRepository {
  const owned = (owner: { tenantId: string; studentId: string; conversationId: string }) =>
    (store.conversations ?? []).some(
      (entry) =>
        entry.id === owner.conversationId &&
        entry.tenantId === owner.tenantId &&
        entry.studentId === owner.studentId,
    );
  const turnsOf = (conversationId: string) =>
    (store.conversationTurns ?? []).filter((turn) => turn.conversationId === conversationId);

  return {
    findOrCreate: ({ tenantId, studentId, termId, now }) => {
      const existing = (store.conversations ?? []).find(
        (entry) =>
          entry.tenantId === tenantId && entry.studentId === studentId && entry.termId === termId,
      );
      if (existing) {
        return Promise.resolve(existing);
      }
      const created = createConversation({
        id: syntheticId('conversation', (store.conversations ?? []).length + 1),
        tenantId,
        studentId,
        termId,
        createdAt: now,
      });
      store.conversations = [...(store.conversations ?? []), created];
      return Promise.resolve(created);
    },
    listRecent: ({ tenantId, studentId, conversationId, limit }) =>
      Promise.resolve(
        owned({ tenantId, studentId, conversationId })
          ? turnsOf(conversationId)
              .sort((left, right) => right.sequence - left.sequence)
              .slice(0, Math.max(limit, 0))
              .reverse()
          : [],
      ),
    appendTurns: (request) => Promise.resolve(append(store, request)),
    countStudentTurnsSince: ({ tenantId, studentId, since }) =>
      Promise.resolve(
        (store.studentTurnLog ?? []).filter(
          (entry) =>
            entry.tenantId === tenantId &&
            entry.studentId === studentId &&
            Date.parse(entry.createdAt) >= Date.parse(since),
        ).length,
      ),
    clear: ({ tenantId, studentId, conversationId }) => {
      // SAFETY: only the turns go; the log keeps counting toward the rate limit.
      if (owned({ tenantId, studentId, conversationId })) {
        store.conversationTurns = (store.conversationTurns ?? []).filter(
          (turn) => turn.conversationId !== conversationId,
        );
      }
      return Promise.resolve();
    },
  };
}
