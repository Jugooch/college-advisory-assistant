/**
 * @file Table definition for the attempts each student snapshot contains.
 * @module @caa/db/tables/student-snapshot-attempt
 * @requirement FR-05
 * @requirement NFR-01
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import { check, foreignKey, integer, pgTable, primaryKey, unique, uuid } from 'drizzle-orm/pg-core';

import { courseAttemptTable } from './course-attempt.table';
import { institutionTable } from './institution.table';
import { studentSnapshotTable } from './student-snapshot.table';

/**
 * The `student_snapshot_attempt` table: a snapshot's attempt list, fixed when the snapshot is
 * written. An attempt unchanged between two imports belongs to both snapshots.
 */
export const studentSnapshotAttemptTable = pgTable(
  'student_snapshot_attempt',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    /** Student of both the snapshot and the attempt; the foreign keys make them match. */
    studentId: uuid('student_id').notNull(),
    studentSnapshotId: uuid('student_snapshot_id').notNull(),
    courseAttemptId: uuid('course_attempt_id').notNull(),
    /** Zero-based position in the snapshot's `attemptIds`, so the list reads back in order. */
    position: integer('position').notNull(),
  },
  (table) => [
    // SAFETY: an attempt listed twice in one snapshot could be counted twice.
    primaryKey({
      name: 'student_snapshot_attempt_pkey',
      columns: [table.tenantId, table.studentSnapshotId, table.courseAttemptId],
    }),
    unique('student_snapshot_attempt_position_key').on(
      table.tenantId,
      table.studentSnapshotId,
      table.position,
    ),
    // SECURITY: snapshot and attempt must both belong to this tenant and this student.
    foreignKey({
      name: 'student_snapshot_attempt_snapshot_fk',
      columns: [table.tenantId, table.studentId, table.studentSnapshotId],
      foreignColumns: [
        studentSnapshotTable.tenantId,
        studentSnapshotTable.studentId,
        studentSnapshotTable.id,
      ],
    }),
    foreignKey({
      name: 'student_snapshot_attempt_attempt_fk',
      columns: [table.tenantId, table.studentId, table.courseAttemptId],
      foreignColumns: [
        courseAttemptTable.tenantId,
        courseAttemptTable.studentId,
        courseAttemptTable.id,
      ],
    }),
    check('student_snapshot_attempt_position_nonnegative', sql`${table.position} >= 0`),
  ],
);
