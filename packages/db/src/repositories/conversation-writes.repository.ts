/**
 * @file Conversation writes: the transaction behind the repository's append.
 * @module @caa/db/repositories/conversation-writes
 * @requirement FR-14
 * @requirement NFR-08
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { and, eq, inArray, lt, lte, or, type SQL } from 'drizzle-orm';

import type {
  Conversation,
  ConversationId,
  ConversationTurn,
  InstitutionId,
  StudentId,
  TermId,
} from '@caa/domain';

import type { Database } from '../client';
import {
  type StoredConversationTurn,
  toConversation,
  toStoredConversationTurn,
} from '../mappers/conversation.mapper';
import { conversationTable, conversationTurnTable } from '../tables/conversation.table';

/** A turn to append. The repository assigns the ID, conversation and sequence. */
export type NewConversationTurn = ConversationTurn extends infer Turn
  ? Turn extends ConversationTurn
    ? Omit<Turn, 'id' | 'conversationId' | 'sequence'>
    : never
  : never;

/** What to append and what to keep afterwards. */
export interface AppendTurnsRequest {
  readonly tenantId: InstitutionId;
  /** The conversation's owner, from the session. */
  readonly studentId: StudentId;
  readonly conversationId: ConversationId;
  /** The sequence of the newest turn the caller saw; 0 for a conversation with no turns yet. */
  readonly expectedSequence: number;
  readonly turns: readonly NewConversationTurn[];
  /** Turns created before this instant are deleted. A turn created exactly then is kept. */
  readonly retainSince: string;
  /** Only the newest this-many turns are kept. */
  readonly retainCount: number;
}

/** Result of {@link ConversationRepository.appendTurns}. */
export type AppendTurnsResult =
  | { readonly status: 'APPENDED'; readonly turns: readonly StoredConversationTurn[] }
  | { readonly status: 'SEQUENCE_CONFLICT' }
  | { readonly status: 'CONVERSATION_NOT_FOUND' };

/** Which conversation to find or create. All three come from the session and the term choice. */
export interface FindOrCreateConversationRequest {
  readonly tenantId: InstitutionId;
  readonly studentId: StudentId;
  readonly termId: TermId;
  /** Creation time if the conversation is new. ISO 8601 with offset; from an injected clock. */
  readonly now: string;
}

/** Which conversation to clear. */
export interface ClearConversationRequest {
  readonly tenantId: InstitutionId;
  readonly studentId: StudentId;
  readonly conversationId: ConversationId;
}

/**
 * Builds the condition that selects a conversation only for its tenant and owning student.
 *
 * @param tenantId - Tenant from the session.
 * @param studentId - Owner from the session.
 * @param conversationId - Conversation to select.
 * @returns A condition for the `conversation` table.
 */
export function ownedBy(
  tenantId: InstitutionId,
  studentId: StudentId,
  conversationId: ConversationId,
): SQL | undefined {
  return and(
    eq(conversationTable.tenantId, tenantId),
    eq(conversationTable.studentId, studentId),
    eq(conversationTable.id, conversationId),
  );
}

/**
 * Appends turns in one transaction, then applies retention.
 *
 * @param db - Typed database handle, bound first so the returned function takes one argument.
 * @param request - The turns, the sequence the caller saw, and the retention bounds.
 * @returns The stored turns, `SEQUENCE_CONFLICT`, or `CONVERSATION_NOT_FOUND`.
 */
export const appendConversationTurns =
  (db: Database) =>
  async (request: AppendTurnsRequest): Promise<AppendTurnsResult> => {
    const { tenantId, studentId, conversationId, expectedSequence, turns } = request;
    return await db.transaction(async (tx) => {
      // SECURITY: looked up by tenant and owner, so another student's conversation is not found.
      // The row lock serializes appends to one conversation, so the check below can't be raced.
      const locked = await tx
        .select({ lastSequence: conversationTable.lastSequence })
        .from(conversationTable)
        .where(ownedBy(tenantId, studentId, conversationId))
        .for('update');
      if (!locked[0]) {
        return { status: 'CONVERSATION_NOT_FOUND' };
      }
      // SAFETY: only the next number after the one the caller saw is accepted, so a stale
      // caller can't interleave or leave a gap in the history.
      if (locked[0].lastSequence !== expectedSequence) {
        return { status: 'SEQUENCE_CONFLICT' };
      }
      const lastSequence = expectedSequence + turns.length;
      const stored =
        turns.length === 0
          ? []
          : await tx
              .insert(conversationTurnTable)
              .values(
                turns.map((turn, index) => ({
                  tenantId,
                  conversationId,
                  sequence: expectedSequence + index + 1,
                  role: turn.role,
                  text: turn.text,
                  blockRefs: turn.role === 'ASSISTANT' ? [...turn.blockRefs] : null,
                  modelStatus: turn.role === 'ASSISTANT' ? turn.modelStatus : null,
                  metadata: turn.role === 'ASSISTANT' ? turn.metadata : null,
                  createdAt: new Date(turn.createdAt),
                })),
              )
              .returning();
      await tx
        .update(conversationTable)
        .set({ lastSequence })
        .where(ownedBy(tenantId, studentId, conversationId));
      await tx
        .delete(conversationTurnTable)
        .where(
          and(
            eq(conversationTurnTable.tenantId, tenantId),
            eq(conversationTurnTable.conversationId, conversationId),
            or(
              lt(conversationTurnTable.createdAt, new Date(request.retainSince)),
              lte(conversationTurnTable.sequence, lastSequence - request.retainCount),
            ),
          ),
        );
      return { status: 'APPENDED', turns: stored.map(toStoredConversationTurn) };
    });
  };

/**
 * Returns the student's conversation for the term, creating it when absent.
 *
 * @param db - Typed database handle, bound first so the returned function takes one argument.
 * @param request - Tenant, student, term, and creation time.
 * @returns The conversation.
 */
export const findOrCreateConversation =
  (db: Database) =>
  async (request: FindOrCreateConversationRequest): Promise<Conversation> => {
    const { tenantId, studentId, termId, now } = request;
    const inserted = await db
      .insert(conversationTable)
      .values({ tenantId, studentId, termId, createdAt: new Date(now) })
      .onConflictDoNothing()
      .returning();
    const rows =
      inserted.length > 0
        ? inserted
        : await db
            .select()
            .from(conversationTable)
            .where(
              and(
                eq(conversationTable.tenantId, tenantId),
                eq(conversationTable.studentId, studentId),
                eq(conversationTable.termId, termId),
              ),
            );
    if (!rows[0]) {
      throw new Error('conversation vanished between insert and select');
    }
    return toConversation(rows[0]);
  };

/**
 * Deletes every turn of the owner's conversation. The conversation and its last sequence stay.
 *
 * @param db - Typed database handle, bound first so the returned function takes one argument.
 * @param request - Tenant, owner, and conversation.
 * @returns Nothing; resolves when the turns are deleted.
 */
export const clearConversation =
  (db: Database) =>
  async ({ tenantId, studentId, conversationId }: ClearConversationRequest): Promise<void> => {
    await db.delete(conversationTurnTable).where(
      and(
        eq(conversationTurnTable.tenantId, tenantId),
        eq(conversationTurnTable.conversationId, conversationId),
        inArray(
          conversationTurnTable.conversationId,
          db
            .select({ id: conversationTable.id })
            .from(conversationTable)
            .where(ownedBy(tenantId, studentId, conversationId)),
        ),
      ),
    );
  };
