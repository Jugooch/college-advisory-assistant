/**
 * @file Table definition for advisor cases: a student's app-internal request for attention.
 * @module @caa/db/tables/advising-case
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-17
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import type { CaseReason, CaseStatus, DiscrepancySubject } from '@caa/domain';

import { institutionTable } from './institution.table';
import { planRevisionTable } from './plan-revision.table';
import { studentTable } from './student.table';
import { userIdentityTable } from './user-identity.table';

/**
 * The `advising_case` table. Status, owner and `last_sequence` are the current state; the
 * history is the append-only `case_event` table. A row changes only in the transaction that
 * inserts the next event, and a trigger (migration 0014) refuses every other change.
 */
export const advisingCaseTable = pgTable(
  'advising_case',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    studentId: uuid('student_id').notNull(),
    reason: text('reason').notNull().$type<CaseReason>(),
    planRevisionId: uuid('plan_revision_id'),
    // NOTE: copied from the revision and held equal to it by the revision foreign key; it exists
    // so the one-open-case-per-plan index can name the plan. Null exactly when there is no revision.
    planId: uuid('plan_id'),
    discrepancySubject: text('discrepancy_subject').$type<DiscrepancySubject>(),
    // SECURITY: never logged, never in an error message, never sent to a model.
    studentNote: text('student_note').notNull(),
    status: text('status').notNull().$type<CaseStatus>(),
    ownerUserId: uuid('owner_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull(),
    /** Sequence of the latest event; the optimistic-concurrency guard. */
    lastSequence: integer('last_sequence').notNull(),
  },
  (table) => [
    // SECURITY: target of composite foreign keys, so events can't reference another tenant's case.
    unique('advising_case_tenant_id_id_key').on(table.tenantId, table.id),
    // SECURITY: the student must be this tenant's.
    foreignKey({
      name: 'advising_case_student_fk',
      columns: [table.tenantId, table.studentId],
      foreignColumns: [studentTable.tenantId, studentTable.id],
    }),
    // SAFETY: the revision must be this tenant's and this student's, and the plan the revision's.
    // A null revision (a source discrepancy) skips the key, which the shape check allows.
    foreignKey({
      name: 'advising_case_plan_revision_fk',
      columns: [table.tenantId, table.planRevisionId, table.planId, table.studentId],
      foreignColumns: [
        planRevisionTable.tenantId,
        planRevisionTable.id,
        planRevisionTable.planId,
        planRevisionTable.studentId,
      ],
    }),
    foreignKey({
      name: 'advising_case_owner_fk',
      columns: [table.tenantId, table.ownerUserId],
      foreignColumns: [userIdentityTable.tenantId, userIdentityTable.id],
    }),
    // SAFETY: at most one open or in-review case per plan (ADR-0013 §6).
    uniqueIndex('advising_case_one_open_per_plan_idx')
      .on(table.tenantId, table.planId)
      .where(sql`${table.status} IN ('OPEN', 'IN_REVIEW') AND ${table.planId} IS NOT NULL`),
    check(
      'advising_case_shape',
      sql`${table.reason} IN ('PLAN_REVIEW', 'NEEDS_VERIFICATION', 'SOURCE_DISCREPANCY')
        AND ${table.status} IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'WITHDRAWN')
        AND ${table.lastSequence} >= 1
        AND char_length(btrim(${table.studentNote})) BETWEEN 1 AND 500
        AND (${table.planRevisionId} IS NULL) = (${table.planId} IS NULL)
        AND (${table.reason} = 'SOURCE_DISCREPANCY' OR ${table.planRevisionId} IS NOT NULL)
        AND (${table.reason} = 'SOURCE_DISCREPANCY') = (${table.discrepancySubject} IS NOT NULL)
        AND (${table.discrepancySubject} IS NULL OR ${table.discrepancySubject} IN
          ('PROGRAM_OR_CATALOG', 'COURSE_ATTEMPT', 'AUDIT_REQUIREMENT', 'SECTION'))
        AND (${table.status} IN ('IN_REVIEW', 'RESOLVED')) = (${table.ownerUserId} IS NOT NULL)`,
    ),
    index('advising_case_student_idx').on(table.tenantId, table.studentId, table.createdAt),
    index('advising_case_status_idx').on(table.tenantId, table.status, table.createdAt),
  ],
);

/** A row read from {@link advisingCaseTable}. Never leaves this package. */
export type AdvisingCaseRow = typeof advisingCaseTable.$inferSelect;
