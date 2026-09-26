/**
 * @file Table definition for students imported from the roster source.
 * @module @caa/db/tables/student
 * @requirement FR-02
 * @requirement FR-03
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import {
  boolean,
  foreignKey,
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
  ],
);

/** A row read from {@link studentTable}. Never leaves this package. */
export type StudentRow = typeof studentTable.$inferSelect;
