/**
 * @file Data access for conversations and their append-only turns, with bounded retention.
 * @module @caa/db/repositories/conversation
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-14
 * @requirement NFR-08
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { and, count, desc, eq, gte } from 'drizzle-orm';

import type { Conversation, ConversationId, InstitutionId, StudentId } from '@caa/domain';

import type { Database } from '../client';
import {
  type StoredConversationTurn,
  toStoredConversationTurn,
} from '../mappers/conversation.mapper';
import {
  conversationTable,
  conversationTurnTable,
  studentTurnLogTable,
} from '../tables/conversation.table';
import {
  appendConversationTurns,
  type AppendTurnsRequest,
  type AppendTurnsResult,
  clearConversation,
  type ClearConversationRequest,
  findOrCreateConversation,
  type FindOrCreateConversationRequest,
  ownedBy,
} from './conversation-writes.repository';

export type {
  AppendTurnsRequest,
  AppendTurnsResult,
  ClearConversationRequest,
  FindOrCreateConversationRequest,
  NewConversationTurn,
} from './conversation-writes.repository';

/** Which turns to read. */
export interface ListRecentTurnsRequest {
  readonly tenantId: InstitutionId;
  /** The conversation's owner, from the session. Another student's conversation is never read. */
  readonly studentId: StudentId;
  readonly conversationId: ConversationId;
  readonly limit: number;
}

/** Which student's turns to count. */
export interface CountStudentTurnsRequest {
  readonly tenantId: InstitutionId;
  readonly studentId: StudentId;
  /** Count turns created at or after this instant. */
  readonly since: string;
}

/** Reads and writes conversations. Every method is scoped by tenant and owning student. */
export interface ConversationRepository {
  /**
   * Returns the student's conversation for the term, creating it when absent.
   *
   * @param request - Tenant, student, term, and creation time.
   * @returns The conversation.
   */
  findOrCreate(request: FindOrCreateConversationRequest): Promise<Conversation>;

  /**
   * Lists the newest turns, oldest first.
   *
   * @param request - Tenant, owner, conversation, and the most turns to return.
   * @returns At most `limit` turns; empty when the conversation is not the owner's.
   */
  listRecent(request: ListRecentTurnsRequest): Promise<readonly StoredConversationTurn[]>;

  /**
   * Appends turns in one transaction, then applies retention. A stale `expectedSequence` is
   * refused. Retention deletes turns older than `retainSince` and turns beyond the newest
   * `retainCount`.
   *
   * @param request - The turns, the sequence the caller saw, and the retention bounds.
   * @returns The stored turns, `SEQUENCE_CONFLICT`, or `CONVERSATION_NOT_FOUND`.
   */
  appendTurns(request: AppendTurnsRequest): Promise<AppendTurnsResult>;

  /**
   * Counts the student's own turns since an instant, across their conversations, for the rate limit.
   * Counts a content-free log, so clearing and retention never lower it (ADR-0015 §2).
   *
   * @param request - Tenant, student, and the window start.
   * @returns The number of student turns.
   */
  countStudentTurnsSince(request: CountStudentTurnsRequest): Promise<number>;

  /**
   * Deletes every turn of the owner's conversation. The conversation and its last sequence stay.
   *
   * @param request - Tenant, owner, and conversation.
   */
  clear(request: ClearConversationRequest): Promise<void>;
}

/**
 * Creates the conversation repository.
 *
 * @param db - Typed database handle.
 * @returns A {@link ConversationRepository}.
 */
export function createConversationRepository(db: Database): ConversationRepository {
  return {
    findOrCreate: findOrCreateConversation(db),

    async listRecent({ tenantId, studentId, conversationId, limit }) {
      const rows = await db
        .select({ turn: conversationTurnTable })
        .from(conversationTurnTable)
        .innerJoin(
          conversationTable,
          and(
            eq(conversationTable.tenantId, conversationTurnTable.tenantId),
            eq(conversationTable.id, conversationTurnTable.conversationId),
          ),
        )
        .where(ownedBy(tenantId, studentId, conversationId))
        .orderBy(desc(conversationTurnTable.sequence))
        .limit(limit);
      return rows.map((row) => toStoredConversationTurn(row.turn)).reverse();
    },

    appendTurns: appendConversationTurns(db),

    async countStudentTurnsSince({ tenantId, studentId, since }) {
      const rows = await db
        .select({ total: count() })
        .from(studentTurnLogTable)
        .where(
          and(
            eq(studentTurnLogTable.tenantId, tenantId),
            eq(studentTurnLogTable.studentId, studentId),
            gte(studentTurnLogTable.createdAt, new Date(since)),
          ),
        );
      return rows[0]?.total ?? 0;
    },

    clear: clearConversation(db),
  };
}
