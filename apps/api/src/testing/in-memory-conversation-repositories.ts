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
  NewConversationTurn,
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
  /** Last sequence by conversation id. Clearing keeps it, as `last_sequence` does in PostgreSQL. */
  lastSequences?: Readonly<Record<string, number>>;
}

/**
 * Reads a conversation's last sequence: the larger of the kept value, which a clear leaves
 * alone, and the newest stored turn.
 *
 * @param store - Backing data.
 * @param conversationId - The conversation.
 * @returns The last sequence, 0 for a conversation that never had a turn.
 */
function lastSequenceOf(
  store: InMemoryConversationStore,
  conversationId: Conversation['id'],
): number {
  const stored = (store.conversationTurns ?? [])
    .filter((turn) => turn.conversationId === conversationId)
    .map((turn) => turn.sequence);
  return Math.max(store.lastSequences?.[conversationId] ?? 0, ...stored);
}

/** Who a conversation must belong to. */
interface Owner {
  readonly tenantId: string;
  readonly studentId: string;
  readonly conversationId: string;
}

/**
 * Tells whether the conversation belongs to the tenant and student.
 *
 * @param store - Backing data.
 * @param owner - Tenant, student and conversation.
 * @returns `true` when it does.
 */
function isOwnedBy(store: InMemoryConversationStore, owner: Owner): boolean {
  return (store.conversations ?? []).some(
    (entry) =>
      entry.id === owner.conversationId &&
      entry.tenantId === owner.tenantId &&
      entry.studentId === owner.studentId,
  );
}

/** Where a new turn lands. */
interface Placement {
  readonly conversationId: Conversation['id'];
  readonly sequence: number;
  readonly idNumber: number;
}

/**
 * Turns a new turn into a stored one.
 *
 * @param turn - The turn to append.
 * @param placement - Its conversation, sequence and id number.
 * @returns The stored turn.
 */
function toStored(turn: NewConversationTurn, placement: Placement): StoredConversationTurn {
  const common = {
    id: ConversationTurnIdSchema.parse(syntheticId('conversationTurn', placement.idNumber)),
    conversationId: placement.conversationId,
    sequence: placement.sequence,
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
}

/**
 * Applies retention to the conversation's turns, as PostgreSQL does on append: turns older than
 * `retainSince` go, then only the newest `retainCount` stay.
 *
 * @param all - Every stored turn.
 * @param request - The append request carrying the bounds.
 * @returns The turns left.
 */
function retain(
  all: readonly StoredConversationTurn[],
  request: AppendTurnsRequest,
): StoredConversationTurn[] {
  const mine = all
    .filter((turn) => turn.conversationId === request.conversationId)
    .filter((turn) => Date.parse(turn.createdAt) >= Date.parse(request.retainSince))
    .sort((left, right) => right.sequence - left.sequence)
    .slice(0, request.retainCount);
  const keep = new Set(mine.map((turn) => turn.id));
  return all.filter((turn) => turn.conversationId !== request.conversationId || keep.has(turn.id));
}

/**
 * Appends turns when the caller saw the last sequence, and logs each student turn.
 *
 * @param store - Backing data.
 * @param request - The append request.
 * @returns The append result.
 */
function append(store: InMemoryConversationStore, request: AppendTurnsRequest): AppendTurnsResult {
  if (!isOwnedBy(store, request)) {
    return { status: 'CONVERSATION_NOT_FOUND' };
  }
  const last = lastSequenceOf(store, request.conversationId);
  if (last !== request.expectedSequence) {
    return { status: 'SEQUENCE_CONFLICT' };
  }
  const base = Math.max(
    (store.conversationTurns ?? []).length,
    Object.values(store.lastSequences ?? {}).reduce((sum, value) => sum + value, 0),
  );
  const stored = request.turns.map((turn, index) =>
    toStored(turn, { ...request, sequence: last + index + 1, idNumber: base + index + 1 }),
  );
  store.conversationTurns = retain([...(store.conversationTurns ?? []), ...stored], request);
  store.lastSequences = { ...store.lastSequences, [request.conversationId]: last + stored.length };
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
  const owned = (owner: Owner) => isOwnedBy(store, owner);
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
        store.lastSequences = {
          ...store.lastSequences,
          [conversationId]: lastSequenceOf(store, conversationId),
        };
        store.conversationTurns = (store.conversationTurns ?? []).filter(
          (turn) => turn.conversationId !== conversationId,
        );
      }
      return Promise.resolve();
    },
  };
}
