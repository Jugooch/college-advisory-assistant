/**
 * @file Converts conversation and turn rows into domain objects.
 * @module @caa/db/mappers/conversation
 * @requirement FR-14
 * @requirement NFR-08
 */
import {
  type Conversation,
  type ConversationId,
  ConversationIdSchema,
  type ConversationTurnId,
  ConversationTurnIdSchema,
  createConversation,
  type TurnRole,
  TurnRoleSchema,
} from '@caa/domain';

import type {
  ConversationRow,
  ConversationTurnRow,
  StoredModelStatus,
} from '../tables/conversation.table';

/**
 * A stored turn. Block references and metadata are opaque JSON here: the api parses them with
 * the contract schema on read (ADR-0013 §2), so this package never imports that schema. A
 * student turn has `null` for all three of them (the table's shape check guarantees it).
 */
export interface StoredConversationTurn {
  readonly id: ConversationTurnId;
  readonly conversationId: ConversationId;
  readonly sequence: number;
  readonly role: TurnRole;
  readonly text: string;
  readonly blockRefs: unknown;
  readonly modelStatus: StoredModelStatus | null;
  readonly metadata: unknown;
  /** ISO 8601 with offset. */
  readonly createdAt: string;
}

/**
 * Maps a conversation row to a validated domain object.
 *
 * @param row - Row read from the `conversation` table.
 * @returns The domain conversation, with the timestamp as an ISO string.
 * @throws {z.ZodError} When the stored row violates the domain schema.
 */
export function toConversation(row: ConversationRow): Conversation {
  return createConversation({
    id: row.id,
    tenantId: row.tenantId,
    studentId: row.studentId,
    termId: row.termId,
    createdAt: row.createdAt.toISOString(),
  });
}

/**
 * Maps a turn row to a stored turn, validating its identifiers and role and keeping the
 * JSON columns untouched.
 *
 * @param row - Row read from the `conversation_turn` table.
 * @returns The stored turn, with the timestamp as an ISO string.
 * @throws {z.ZodError} When an identifier or the role is invalid.
 */
export function toStoredConversationTurn(row: ConversationTurnRow): StoredConversationTurn {
  return {
    id: ConversationTurnIdSchema.parse(row.id),
    conversationId: ConversationIdSchema.parse(row.conversationId),
    sequence: row.sequence,
    role: TurnRoleSchema.parse(row.role),
    text: row.text,
    blockRefs: row.blockRefs,
    modelStatus: row.modelStatus,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}
