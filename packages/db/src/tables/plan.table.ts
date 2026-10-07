/**
 * @file Table definition for plans: one draft plan per student per term.
 * @module @caa/db/tables/plan
 * @requirement FR-11
 * @requirement FR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { foreignKey, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { institutionTable } from './institution.table';
import { studentTable } from './student.table';
import { termTable } from './term.table';

/**
 * The `plan` table. One row per student and term, never updated; its history is the
 * append-only `plan_revision` table.
 */
export const planTable = pgTable(
  'plan',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    studentId: uuid('student_id').notNull(),
    termId: uuid('term_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull(),
  },
  (table) => [
    // NOTE: ADR-0013 §1, one plan per student per term.
    unique('plan_tenant_student_term_key').on(table.tenantId, table.studentId, table.termId),
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('plan_tenant_id_id_key').on(table.tenantId, table.id),
    // SAFETY: target of the revision key, so a revision always carries its plan's student and term.
    unique('plan_tenant_id_id_student_id_term_id_key').on(
      table.tenantId,
      table.id,
      table.studentId,
      table.termId,
    ),
    // SECURITY: the student and the term must be this tenant's.
    foreignKey({
      name: 'plan_student_fk',
      columns: [table.tenantId, table.studentId],
      foreignColumns: [studentTable.tenantId, studentTable.id],
    }),
    foreignKey({
      name: 'plan_term_fk',
      columns: [table.tenantId, table.termId],
      foreignColumns: [termTable.tenantId, termTable.id],
    }),
  ],
);

/** A row read from {@link planTable}. Never leaves this package. */
export type PlanRow = typeof planTable.$inferSelect;
