/**
 * @file Table definitions for conversations and their append-only turns.
 * @module @caa/db/tables/conversation
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-14
 * @requirement NFR-08
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import type { ConversationTurn, TurnRole } from '@caa/domain';

import { institutionTable } from './institution.table';
import { studentTable } from './student.table';
import { termTable } from './term.table';

/** The model statuses an assistant turn may store. */
export type StoredModelStatus = Extract<ConversationTurn, { role: 'ASSISTANT' }>['modelStatus'];

/**
 * The `conversation` table: one per tenant, student and term (ADR-0015 §7). `last_sequence`
 * is the sequence of the newest turn ever appended; it survives retention and clearing, so a
 * sequence is never reused.
 */
export const conversationTable = pgTable(
  'conversation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    studentId: uuid('student_id').notNull(),
    termId: uuid('term_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull(),
    /** The optimistic-concurrency guard for appends. */
    lastSequence: integer('last_sequence').notNull().default(0),
  },
  (table) => [
    unique('conversation_tenant_student_term_key').on(
      table.tenantId,
      table.studentId,
      table.termId,
    ),
    // SECURITY: target of the turn key, so a turn can't reference another tenant's conversation.
    unique('conversation_tenant_id_id_key').on(table.tenantId, table.id),
    // SECURITY: the student and the term must be this tenant's.
    foreignKey({
      name: 'conversation_student_fk',
      columns: [table.tenantId, table.studentId],
      foreignColumns: [studentTable.tenantId, studentTable.id],
    }),
    foreignKey({
      name: 'conversation_term_fk',
      columns: [table.tenantId, table.termId],
      foreignColumns: [termTable.tenantId, termTable.id],
    }),
    check('conversation_last_sequence_shape', sql`${table.lastSequence} >= 0`),
  ],
);

/**
 * The `conversation_turn` table. A turn is never updated (migration 0019 adds a trigger);
 * retention and clearing delete whole turns. Assistant turns keep block references only, never
 * rendered numbers or text beyond the short intro (ADR-0015 §7).
 */
export const conversationTurnTable = pgTable(
  'conversation_turn',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    sequence: integer('sequence').notNull(),
    role: text('role').notNull().$type<TurnRole>(),
    // SECURITY: free text the student typed or a short assistant intro; never logged.
    text: text('text').notNull(),
    // NOTE: opaque here; the api parses it with the contract schema (ADR-0013 §2).
    blockRefs: jsonb('block_refs').$type<unknown>(),
    modelStatus: text('model_status').$type<StoredModelStatus>(),
    metadata: jsonb('metadata').$type<unknown>(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull(),
  },
  (table) => [
    unique('conversation_turn_conversation_sequence_key').on(table.conversationId, table.sequence),
    foreignKey({
      name: 'conversation_turn_conversation_fk',
      columns: [table.tenantId, table.conversationId],
      foreignColumns: [conversationTable.tenantId, conversationTable.id],
    }),
    // SAFETY: block references, model status and metadata belong to assistant turns only.
    check(
      'conversation_turn_shape',
      sql`${table.sequence} >= 1
        AND ${table.role} IN ('STUDENT', 'ASSISTANT')
        AND (${table.role} = 'ASSISTANT') = (${table.blockRefs} IS NOT NULL)
        AND (${table.role} = 'ASSISTANT') = (${table.metadata} IS NOT NULL)
        AND (${table.role} = 'ASSISTANT') = (${table.modelStatus} IS NOT NULL)
        AND (${table.modelStatus} IS NULL OR ${table.modelStatus} IN
          ('ANSWERED', 'GUARDED', 'BUDGET_EXHAUSTED', 'MODEL_UNAVAILABLE'))`,
    ),
    index('conversation_turn_created_idx').on(
      table.tenantId,
      table.conversationId,
      table.createdAt,
    ),
  ],
);

/** A row read from {@link conversationTable}. Never leaves this package. */
export type ConversationRow = typeof conversationTable.$inferSelect;

/** A row read from {@link conversationTurnTable}. Never leaves this package. */
export type ConversationTurnRow = typeof conversationTurnTable.$inferSelect;
