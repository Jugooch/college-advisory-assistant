/**
 * @file QA-owned in-memory conversation repository for the API acceptance harness. It follows
 * the documented `@caa/db` contract (one conversation per student and term, owner-scoped reads,
 * `expectedSequence` conflicts, retention by age and count, clear that keeps the sequence, and
 * a content-free turn log that clearing and retention never shrink), written here from that
 * contract and not copied from anyone's fakes, so the acceptance oracle stays independent of
 * the code under test.
 * @module @caa/tests/support/conversation-repositories
 * @requirement FR-14
 * @requirement NFR-08
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 * @see docs/standards/07-testing.md
 */
import type {
  AppendTurnsRequest,
  ConversationRepository,
  ConversationSequenceReader,
  FindOrCreateConversationRequest,
  StoredConversationTurn,
} from '@caa/db';
import {
  type Conversation,
  ConversationTurnIdSchema,
  createConversation,
  TurnRole,
} from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

/** One content-free row per student message. */
export interface StudentTurnLogEntry {
  readonly tenantId: string;
  readonly studentId: string;
  /** ISO 8601 with offset. */
  readonly createdAt: string;
}

/** Conversation backing data. A field that is omitted means nothing of that kind is stored. */
export interface ConversationWorld {
  /** Conversations of every tenant. */
  conversations?: readonly Conversation[];
  /** Turns still stored, across conversations. Retention and clear remove entries. */
  conversationTurns?: readonly StoredConversationTurn[];
  /** Newest sequence ever assigned, by conversation ID. Never lowered; absent means 0. */
  conversationLastSequences?: Readonly<Record<string, number>>;
  /** The rate-limit log. Only appends add to it; clear and retention leave it alone. */
  studentTurnLog?: readonly StudentTurnLogEntry[];
}

/** The conversation repository the harness gives the API's `Repositories` under `conversations`. */
export interface ConversationRepositories {
  readonly conversations: ConversationRepository & ConversationSequenceReader;
}

/**
 * Finds a conversation only when the tenant and owning student match.
 *
 * @param world - Backing data.
 * @param owner - Tenant, student and conversation ID from the session and request.
 * @returns The conversation, or undefined when it isn't the owner's.
 */
function ownedConversation(
  world: ConversationWorld,
  owner: { tenantId: string; studentId: string; conversationId: string },
): Conversation | undefined {
  return (world.conversations ?? []).find(
    (entry) =>
      entry.id === owner.conversationId &&
      entry.tenantId === owner.tenantId &&
      entry.studentId === owner.studentId,
  );
}

/**
 * Finds the newest sequence ever assigned in a conversation: the recorded one, or the highest
 * stored turn when a case seeded turns without a matching record.
 *
 * @param world - Backing data.
 * @param conversationId - The conversation.
 * @returns The newest sequence, or 0 when nothing was ever assigned.
 */
function lastSequenceOf(world: ConversationWorld, conversationId: string): number {
  const stored = (world.conversationTurns ?? [])
    .filter((turn) => turn.conversationId === conversationId)
    .map((turn) => turn.sequence);
  return Math.max(world.conversationLastSequences?.[conversationId] ?? 0, ...stored);
}

/**
 * Applies retention to one conversation's turns: a turn older than `retainSince` goes, and only
 * the newest `retainCount` of the rest stay. A turn created exactly at `retainSince` is kept.
 *
 * @param world - Backing data.
 * @param request - The append request carrying the bounds.
 * @returns Nothing; the world's turns are replaced.
 */
function applyRetention(world: ConversationWorld, request: AppendTurnsRequest): void {
  const since = Date.parse(request.retainSince);
  const others = (world.conversationTurns ?? []).filter(
    (turn) => turn.conversationId !== request.conversationId,
  );
  const mine = (world.conversationTurns ?? [])
    .filter((turn) => turn.conversationId === request.conversationId)
    .filter((turn) => Date.parse(turn.createdAt) >= since)
    .sort((left, right) => right.sequence - left.sequence)
    .slice(0, Math.max(request.retainCount, 0))
    .sort((left, right) => left.sequence - right.sequence);
  world.conversationTurns = [...others, ...mine];
}

/**
 * Stores the turns of an accepted append, logs the student ones, and applies retention.
 *
 * @param world - Backing data.
 * @param request - The accepted request.
 * @param lastSequence - The newest sequence the caller saw.
 * @returns The stored turns.
 */
function store(
  world: ConversationWorld,
  request: AppendTurnsRequest,
  lastSequence: number,
): readonly StoredConversationTurn[] {
  const used = new Set<string>((world.conversationTurns ?? []).map((turn) => turn.id));
  let seed = Math.max(
    Object.values(world.conversationLastSequences ?? {}).reduce((sum, value) => sum + value, 0),
    used.size,
  );
  const stored = request.turns.map((turn, index): StoredConversationTurn => {
    do {
      seed += 1;
    } while (used.has(syntheticId('conversationTurn', seed)));
    const base = {
      id: ConversationTurnIdSchema.parse(syntheticId('conversationTurn', seed)),
      conversationId: request.conversationId,
      sequence: lastSequence + index + 1,
      role: turn.role,
      text: turn.text,
      createdAt: turn.createdAt,
    };
    return turn.role === TurnRole.Assistant
      ? {
          ...base,
          blockRefs: [...turn.blockRefs],
          modelStatus: turn.modelStatus,
          metadata: turn.metadata,
        }
      : { ...base, blockRefs: null, modelStatus: null, metadata: null };
  });
  world.conversationTurns = [...(world.conversationTurns ?? []), ...stored];
  world.conversationLastSequences = {
    ...world.conversationLastSequences,
    [request.conversationId]: lastSequence + stored.length,
  };
  // SAFETY: the log is separate from the turns, so retention and clear can't lower the count.
  world.studentTurnLog = [
    ...(world.studentTurnLog ?? []),
    ...request.turns
      .filter((turn) => turn.role === TurnRole.Student)
      .map((turn) => ({
        tenantId: request.tenantId,
        studentId: request.studentId,
        createdAt: turn.createdAt,
      })),
  ];
  applyRetention(world, request);
  return stored;
}

/**
 * Returns the student's conversation for the term, creating it when absent.
 *
 * @param world - Backing data.
 * @param request - Tenant, student, term, and creation time.
 * @returns The conversation.
 */
function findOrCreate(
  world: ConversationWorld,
  { tenantId, studentId, termId, now }: FindOrCreateConversationRequest,
): Conversation {
  const existing = (world.conversations ?? []).find(
    (entry) =>
      entry.tenantId === tenantId && entry.studentId === studentId && entry.termId === termId,
  );
  if (existing) {
    return existing;
  }
  const taken = new Set<string>((world.conversations ?? []).map((entry) => entry.id));
  let seed = taken.size + 1;
  while (taken.has(syntheticId('conversation', seed))) {
    seed += 1;
  }
  const created = createConversation({
    id: syntheticId('conversation', seed),
    tenantId,
    studentId,
    termId,
    createdAt: now,
  });
  world.conversations = [...(world.conversations ?? []), created];
  return created;
}

/**
 * Creates the conversation repositories over the world. Every call reads the world again.
 *
 * @param world - Backing data.
 * @returns The repositories to spread into the harness's `Repositories`.
 */
export function createConversationRepositories(world: ConversationWorld): ConversationRepositories {
  return {
    conversations: {
      findOrCreate: (request) => Promise.resolve(findOrCreate(world, request)),

      listRecent: ({ tenantId, studentId, conversationId, limit }) => {
        if (!ownedConversation(world, { tenantId, studentId, conversationId })) {
          return Promise.resolve([]);
        }
        const newest = (world.conversationTurns ?? [])
          .filter((turn) => turn.conversationId === conversationId)
          .sort((left, right) => right.sequence - left.sequence)
          .slice(0, Math.max(limit, 0));
        return Promise.resolve(newest.reverse());
      },

      appendTurns: (request) => {
        const owned = ownedConversation(world, request);
        if (!owned) {
          return Promise.resolve({ status: 'CONVERSATION_NOT_FOUND' });
        }
        const lastSequence = lastSequenceOf(world, owned.id);
        // SAFETY: only the next number after the one the caller saw is accepted.
        if (lastSequence !== request.expectedSequence) {
          return Promise.resolve({ status: 'SEQUENCE_CONFLICT' });
        }
        return Promise.resolve({ status: 'APPENDED', turns: store(world, request, lastSequence) });
      },

      findLastSequence: ({ tenantId, studentId, conversationId }) =>
        Promise.resolve(
          ownedConversation(world, { tenantId, studentId, conversationId })
            ? lastSequenceOf(world, conversationId)
            : null,
        ),

      countStudentTurnsSince: ({ tenantId, studentId, since }) =>
        Promise.resolve(
          (world.studentTurnLog ?? []).filter(
            (entry) =>
              entry.tenantId === tenantId &&
              entry.studentId === studentId &&
              Date.parse(entry.createdAt) >= Date.parse(since),
          ).length,
        ),

      clear: ({ tenantId, studentId, conversationId }) => {
        if (ownedConversation(world, { tenantId, studentId, conversationId })) {
          world.conversationTurns = (world.conversationTurns ?? []).filter(
            (turn) => turn.conversationId !== conversationId,
          );
        }
        return Promise.resolve();
      },
    },
  };
}
