/**
 * @file Table definition for students imported from the roster source.
 * @module @caa/db/tables/student
 * @requirement FR-02
 * @requirement FR-03
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { institutionTable } from './institution.table';
import { userIdentityTable } from './user-identity.table';

/**
 * The `student` table. One row per source student per tenant.
 *
 * SECURITY: data minimization. No names, emails, or other personal fields are stored.
 */
export const studentTable = pgTable(
  'student',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    sourceStudentId: text('source_student_id').notNull(),
    /**
     * Roster source whose batch last changed this row. A `FULL` batch from that source may mark
     * the student deleted when it's missing (#30). Null when the row wasn't written by a roster
     * import (seed data, or rows from before sources were recorded); such a row is never
     * reconciled, so it's removed only by a tombstone.
     */
    sourceId: text('source_id'),
    /** Linked login, or null until the student signs in. */
    userId: uuid('user_id'),
    /** Source record version, or null when the source does not supply one. */
    recordVersion: integer('record_version'),
    /** Effective time of the batch that last changed this row. Older batches never overwrite it. */
    sourceEffectiveAt: timestamp('source_effective_at', { withTimezone: true }).notNull(),
    /** Tombstone set by the source. A deleted student is invisible to readers. */
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('student_tenant_id_source_student_id_key').on(table.tenantId, table.sourceStudentId),
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('student_tenant_id_id_key').on(table.tenantId, table.id),
    foreignKey({
      name: 'student_user_fk',
      columns: [table.tenantId, table.userId],
      foreignColumns: [userIdentityTable.tenantId, userIdentityTable.id],
    }),
    check(
      'student_source_id_not_empty',
      sql`${table.sourceId} IS NULL OR length(${table.sourceId}) > 0`,
    ),
    // PERF: a FULL batch reconciles the students of one tenant and source.
    index('student_tenant_id_source_id_idx').on(table.tenantId, table.sourceId),
  ],
);

/** A row read from {@link studentTable}. Never leaves this package. */
export type StudentRow = typeof studentTable.$inferSelect;
