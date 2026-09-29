/**
 * @file Table definition for the attempts an audit allocated to each requirement.
 * @module @caa/db/tables/requirement-result-allocated-attempt
 * @requirement FR-05
 * @requirement NFR-01
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import { check, foreignKey, integer, pgTable, primaryKey, unique, uuid } from 'drizzle-orm/pg-core';

import { auditSnapshotTable } from './audit-snapshot.table';
import { institutionTable } from './institution.table';
import { requirementResultTable } from './requirement-result.table';
import { studentSnapshotAttemptTable } from './student-snapshot-attempt.table';

/**
 * The `requirement_result_allocated_attempt` table: a requirement's `allocatedAttemptIds`,
 * written with the audit and never changed. The keys make every allocated attempt one of the
 * attempts in the student snapshot the audit is pinned to.
 */
export const requirementResultAllocatedAttemptTable = pgTable(
  'requirement_result_allocated_attempt',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    /** Audit of the requirement; the foreign keys make it the requirement's own audit. */
    auditSnapshotId: uuid('audit_snapshot_id').notNull(),
    requirementResultId: uuid('requirement_result_id').notNull(),
    /** The audit's pinned student snapshot; the foreign keys make it match the audit row. */
    studentSnapshotId: uuid('student_snapshot_id').notNull(),
    courseAttemptId: uuid('course_attempt_id').notNull(),
    /** Zero-based position in the requirement's `allocatedAttemptIds`, so it reads back in order. */
    position: integer('position').notNull(),
  },
  (table) => [
    // SAFETY: an attempt allocated twice to one requirement would count its credits twice.
    primaryKey({
      name: 'requirement_result_allocated_attempt_pkey',
      columns: [table.tenantId, table.requirementResultId, table.courseAttemptId],
    }),
    unique('requirement_result_allocated_attempt_position_key').on(
      table.tenantId,
      table.requirementResultId,
      table.position,
    ),
    // SECURITY: the requirement belongs to this tenant and to the audit named on the row.
    foreignKey({
      name: 'requirement_result_allocated_attempt_requirement_fk',
      columns: [table.tenantId, table.auditSnapshotId, table.requirementResultId],
      foreignColumns: [
        requirementResultTable.tenantId,
        requirementResultTable.auditSnapshotId,
        requirementResultTable.id,
      ],
    }),
    // SAFETY: the snapshot named on the row is the one the audit is pinned to, not a newer one.
    foreignKey({
      name: 'requirement_result_allocated_attempt_audit_fk',
      columns: [table.tenantId, table.auditSnapshotId, table.studentSnapshotId],
      foreignColumns: [
        auditSnapshotTable.tenantId,
        auditSnapshotTable.id,
        auditSnapshotTable.studentSnapshotId,
      ],
    }),
    // SAFETY: an allocated attempt must be in the pinned snapshot, so an audit can't allocate an
    // attempt the student record it ran against doesn't contain.
    foreignKey({
      name: 'requirement_result_allocated_attempt_snapshot_attempt_fk',
      columns: [table.tenantId, table.studentSnapshotId, table.courseAttemptId],
      foreignColumns: [
        studentSnapshotAttemptTable.tenantId,
        studentSnapshotAttemptTable.studentSnapshotId,
        studentSnapshotAttemptTable.courseAttemptId,
      ],
    }),
    check('requirement_result_allocated_attempt_position_nonnegative', sql`${table.position} >= 0`),
  ],
);

/** A row read from {@link requirementResultAllocatedAttemptTable}. Never leaves this package. */
export type RequirementResultAllocatedAttemptRow =
  typeof requirementResultAllocatedAttemptTable.$inferSelect;
