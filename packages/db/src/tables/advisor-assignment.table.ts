/**
 * @file Table definition for advisor assignments (time-bounded advisor access to a student).
 * @module @caa/db/tables/advisor-assignment
 * @requirement FR-02
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import { check, foreignKey, index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { institutionTable } from './institution.table';
import { studentTable } from './student.table';
import { userIdentityTable } from './user-identity.table';

/** The `advisor_assignment` table. Access ends when `effective_to` passes. */
export const advisorAssignmentTable = pgTable(
  'advisor_assignment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    advisorUserId: uuid('advisor_user_id').notNull(),
    studentId: uuid('student_id').notNull(),
    /** Start of access, inclusive. */
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    /** End of access, exclusive, or null when open-ended. */
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    approvedBy: uuid('approved_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('advisor_assignment_tenant_id_id_key').on(table.tenantId, table.id),
    // SECURITY: the advisor, student, and approver must all belong to the assignment's tenant.
    foreignKey({
      name: 'advisor_assignment_advisor_fk',
      columns: [table.tenantId, table.advisorUserId],
      foreignColumns: [userIdentityTable.tenantId, userIdentityTable.id],
    }),
    foreignKey({
      name: 'advisor_assignment_student_fk',
      columns: [table.tenantId, table.studentId],
      foreignColumns: [studentTable.tenantId, studentTable.id],
    }),
    foreignKey({
      name: 'advisor_assignment_approver_fk',
      columns: [table.tenantId, table.approvedBy],
      foreignColumns: [userIdentityTable.tenantId, userIdentityTable.id],
    }),
    check(
      'advisor_assignment_effective_range',
      sql`${table.effectiveTo} IS NULL OR ${table.effectiveTo} >= ${table.effectiveFrom}`,
    ),
    index('advisor_assignment_lookup_idx').on(table.tenantId, table.advisorUserId, table.studentId),
  ],
);

/** A row read from {@link advisorAssignmentTable}. Never leaves this package. */
export type AdvisorAssignmentRow = typeof advisorAssignmentTable.$inferSelect;
