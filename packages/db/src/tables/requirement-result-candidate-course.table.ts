/**
 * @file Table definition for the courses an audit lists as candidates for each requirement.
 * @module @caa/db/tables/requirement-result-candidate-course
 * @requirement FR-05
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import { check, foreignKey, integer, pgTable, primaryKey, unique, uuid } from 'drizzle-orm/pg-core';

import { courseTable } from './course.table';
import { institutionTable } from './institution.table';
import { requirementResultTable } from './requirement-result.table';

/**
 * The `requirement_result_candidate_course` table: a requirement's `candidateCourseIds`, written
 * with the audit and never changed. Every candidate is a course in the tenant's catalog.
 */
export const requirementResultCandidateCourseTable = pgTable(
  'requirement_result_candidate_course',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    /** Audit of the requirement, so an audit's candidates are read in one query. */
    auditSnapshotId: uuid('audit_snapshot_id').notNull(),
    requirementResultId: uuid('requirement_result_id').notNull(),
    courseId: uuid('course_id').notNull(),
    /** Zero-based position in the requirement's `candidateCourseIds`, so it reads back in order. */
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'requirement_result_candidate_course_pkey',
      columns: [table.tenantId, table.requirementResultId, table.courseId],
    }),
    unique('requirement_result_candidate_course_position_key').on(
      table.tenantId,
      table.requirementResultId,
      table.position,
    ),
    // SECURITY: the requirement belongs to this tenant and to the audit named on the row.
    foreignKey({
      name: 'requirement_result_candidate_course_requirement_fk',
      columns: [table.tenantId, table.auditSnapshotId, table.requirementResultId],
      foreignColumns: [
        requirementResultTable.tenantId,
        requirementResultTable.auditSnapshotId,
        requirementResultTable.id,
      ],
    }),
    // SECURITY: a candidate must be a course in this tenant's catalog.
    foreignKey({
      name: 'requirement_result_candidate_course_course_fk',
      columns: [table.tenantId, table.courseId],
      foreignColumns: [courseTable.tenantId, courseTable.id],
    }),
    check('requirement_result_candidate_course_position_nonnegative', sql`${table.position} >= 0`),
  ],
);

/** A row read from {@link requirementResultCandidateCourseTable}. Never leaves this package. */
export type RequirementResultCandidateCourseRow =
  typeof requirementResultCandidateCourseTable.$inferSelect;
