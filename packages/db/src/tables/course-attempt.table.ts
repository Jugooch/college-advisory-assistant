/**
 * @file Table definition for course attempts (immutable attempt revisions).
 * @module @caa/db/tables/course-attempt
 * @requirement FR-05
 * @requirement FR-06
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import type { AttemptStatus, GradeScheme } from '@caa/domain';

import { courseTable } from './course.table';
import { institutionTable } from './institution.table';
import { studentTable } from './student.table';

/**
 * The `course_attempt` table. Each row is one immutable attempt revision: a changed source
 * attempt (for example a newly posted grade) is a new row with a new ID, so a snapshot that
 * listed the old row keeps it. `source_attempt_id` therefore repeats across revisions.
 */
export const courseAttemptTable = pgTable(
  'course_attempt',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    studentId: uuid('student_id').notNull(),
    courseId: uuid('course_id').notNull(),
    sourceAttemptId: text('source_attempt_id').notNull(),
    /** Source term code, for example `2026FA`. */
    termCode: text('term_code').notNull(),
    status: text('status').notNull().$type<AttemptStatus>(),
    /** Grade scheme; null together with `grade_value` when there is no grade. */
    gradeScheme: text('grade_scheme').$type<GradeScheme>(),
    /** Grade value under `grade_scheme`; null together with it when there is no grade. */
    gradeValue: text('grade_value'),
    /** Earned credits in hundredths, or null when none were earned or none were supplied. */
    creditsEarnedHundredths: integer('credits_earned_hundredths'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('course_attempt_tenant_id_id_key').on(table.tenantId, table.id),
    // SAFETY: lets a snapshot link require that the attempt belongs to the snapshot's student.
    unique('course_attempt_tenant_id_student_id_id_key').on(
      table.tenantId,
      table.studentId,
      table.id,
    ),
    foreignKey({
      name: 'course_attempt_student_fk',
      columns: [table.tenantId, table.studentId],
      foreignColumns: [studentTable.tenantId, studentTable.id],
    }),
    foreignKey({
      name: 'course_attempt_course_fk',
      columns: [table.tenantId, table.courseId],
      foreignColumns: [courseTable.tenantId, courseTable.id],
    }),
    check('course_attempt_source_attempt_id_not_empty', sql`length(${table.sourceAttemptId}) > 0`),
    check('course_attempt_term_code_not_empty', sql`length(${table.termCode}) > 0`),
    check(
      'course_attempt_grade_both_or_neither',
      sql`(${table.gradeScheme} IS NULL) = (${table.gradeValue} IS NULL)`,
    ),
    check(
      'course_attempt_credits_nonnegative',
      sql`${table.creditsEarnedHundredths} IS NULL OR ${table.creditsEarnedHundredths} >= 0`,
    ),
    // SAFETY: mirrors `CourseAttemptSchema`. An unfinished attempt has no final grade, and only
    // completed or awarded attempts earn credit.
    check(
      'course_attempt_ungraded_status_has_no_grade',
      sql`${table.status} NOT IN ('IN_PROGRESS', 'TRANSFER_PENDING') OR ${table.gradeScheme} IS NULL`,
    ),
    check(
      'course_attempt_credits_only_when_earned',
      sql`${table.creditsEarnedHundredths} IS NULL OR ${table.status} IN ('COMPLETED', 'TRANSFER_AWARDED')`,
    ),
  ],
);

/** A row read from {@link courseAttemptTable}. Never leaves this package. */
export type CourseAttemptRow = typeof courseAttemptTable.$inferSelect;
