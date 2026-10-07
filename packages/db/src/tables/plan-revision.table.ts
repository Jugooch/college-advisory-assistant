/**
 * @file Table definition for plan revisions: immutable saved or revalidated states of a plan.
 * @module @caa/db/tables/plan-revision
 * @requirement FR-11
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import type { PlanRevisionCause, ScheduleOutcome } from '@caa/domain';

import { auditSnapshotTable } from './audit-snapshot.table';
import { institutionTable } from './institution.table';
import { planTable } from './plan.table';
import { sectionSnapshotTable } from './section-snapshot.table';
import { studentSnapshotTable } from './student-snapshot.table';
import { userIdentityTable } from './user-identity.table';

/** The revision columns the pinned-record keys use. */
type PinnedColumns = Record<
  | 'tenantId'
  | 'studentId'
  | 'termId'
  | 'studentSnapshotId'
  | 'studentRecordEffectiveAt'
  | 'auditSnapshotId'
  | 'auditSource'
  | 'auditVersion'
  | 'auditRecordEffectiveAt'
  | 'sectionSnapshotId',
  AnyPgColumn
>;

/**
 * Foreign keys that tie each pinned record, with the versions and times copied beside it, to
 * the record itself, so the staleness inputs can't disagree with the snapshots they name.
 *
 * @param table - The revision's columns.
 * @returns The three foreign keys.
 */
function pinnedRecordKeys(table: PinnedColumns) {
  return [
    // SAFETY: pinned records, with their versions and times, must be this student's (sections: the plan term's).
    foreignKey({
      name: 'plan_revision_student_snapshot_fk',
      columns: [
        table.tenantId,
        table.studentId,
        table.studentSnapshotId,
        table.studentRecordEffectiveAt,
      ],
      foreignColumns: [
        studentSnapshotTable.tenantId,
        studentSnapshotTable.studentId,
        studentSnapshotTable.id,
        studentSnapshotTable.sourceEffectiveAt,
      ],
    }),
    foreignKey({
      name: 'plan_revision_audit_snapshot_fk',
      columns: [
        table.tenantId,
        table.studentId,
        table.auditSnapshotId,
        table.auditSource,
        table.auditVersion,
        table.auditRecordEffectiveAt,
      ],
      foreignColumns: [
        auditSnapshotTable.tenantId,
        auditSnapshotTable.studentId,
        auditSnapshotTable.id,
        auditSnapshotTable.auditSource,
        auditSnapshotTable.auditVersion,
        auditSnapshotTable.studentRecordEffectiveAt,
      ],
    }),
    foreignKey({
      name: 'plan_revision_section_snapshot_fk',
      columns: [table.tenantId, table.sectionSnapshotId, table.termId],
      foreignColumns: [
        sectionSnapshotTable.tenantId,
        sectionSnapshotTable.id,
        sectionSnapshotTable.termId,
      ],
    }),
  ];
}

/**
 * The `plan_revision` table. Append-only: a database trigger refuses UPDATE, DELETE and
 * TRUNCATE (migration 0012), so a saved revision is never rewritten.
 */
export const planRevisionTable = pgTable(
  'plan_revision',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    planId: uuid('plan_id').notNull(),
    // NOTE: copied from the plan, and held equal to it by the plan foreign key.
    studentId: uuid('student_id').notNull(),
    termId: uuid('term_id').notNull(),
    /** Position in the plan's history, 1 first. */
    revision: integer('revision').notNull(),
    cause: text('cause').notNull().$type<PlanRevisionCause>(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull(),
    courseIds: uuid('course_ids').array().notNull(),
    // NOTE: the student's inputs are stored as JSONB and parsed with the domain schemas on read.
    creditSelections: jsonb('credit_selections').notNull().$type<unknown>(),
    constraints: jsonb('constraints').notNull().$type<unknown>(),
    studentSnapshotId: uuid('student_snapshot_id').notNull(),
    studentRecordEffectiveAt: timestamp('student_record_effective_at', {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    auditSnapshotId: uuid('audit_snapshot_id').notNull(),
    auditRecordEffectiveAt: timestamp('audit_record_effective_at', {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    auditSource: text('audit_source').notNull(),
    auditVersion: text('audit_version').notNull(),
    rulesetVersion: text('ruleset_version').notNull(),
    sectionSnapshotId: uuid('section_snapshot_id').notNull(),
    campusTransitionVersion: text('campus_transition_version'),
    solverWorkCap: integer('solver_work_cap').notNull(),
    constraintHash: text('constraint_hash').notNull(),
    outcome: text('outcome').notNull().$type<ScheduleOutcome>(),
    selectedSectionIds: uuid('selected_section_ids').array(),
    // NOTE: opaque to this package; the api parses it with the contract schema (ADR-0013 §2).
    result: jsonb('result').notNull().$type<unknown>(),
  },
  (table) => [
    // SAFETY: turns a lost append race into a conflict (ADR-0011); the next key is the case FK target.
    unique('plan_revision_plan_revision_key').on(table.planId, table.revision),
    unique('plan_revision_tenant_id_id_key').on(table.tenantId, table.id),
    // SECURITY: the plan must be this tenant's, and the revision's student and term the plan's.
    foreignKey({
      name: 'plan_revision_plan_fk',
      columns: [table.tenantId, table.planId, table.studentId, table.termId],
      foreignColumns: [planTable.tenantId, planTable.id, planTable.studentId, planTable.termId],
    }),
    ...pinnedRecordKeys(table),
    foreignKey({
      name: 'plan_revision_created_by_fk',
      columns: [table.tenantId, table.createdBy],
      foreignColumns: [userIdentityTable.tenantId, userIdentityTable.id],
    }),
    check(
      'plan_revision_bounds',
      sql`${table.revision} >= 1 AND cardinality(${table.courseIds}) BETWEEN 1 AND 8
        AND ${table.solverWorkCap} BETWEEN 1 AND 3000000
        AND ${table.constraintHash} ~ '^sha256:[0-9a-f]{64}$' AND length(${table.auditSource}) > 0
        AND length(${table.auditVersion}) > 0 AND length(${table.rulesetVersion}) > 0
        AND ${table.cause} IN ('SAVED', 'REVALIDATED') AND ${table.outcome} IN
        ('OPTIONS_FOUND', 'NO_FEASIBLE_PLAN', 'SEARCH_TIMEOUT', 'NEEDS_VERIFICATION')`,
    ),
    // SAFETY: a selection exactly when the outcome has options, so a revision never shows a
    // schedule the engine didn't produce.
    check(
      'plan_revision_selection_matches_outcome',
      sql`(${table.outcome} = 'OPTIONS_FOUND') = (${table.selectedSectionIds} IS NOT NULL)`,
    ),
    check(
      'plan_revision_json_shape',
      sql`jsonb_typeof(${table.result}) = 'object' AND jsonb_typeof(${table.creditSelections}) = 'array'
        AND jsonb_typeof(${table.constraints}) = 'array'`,
    ),
  ],
);

/** A row read from {@link planRevisionTable}. Never leaves this package. */
export type PlanRevisionRow = typeof planRevisionTable.$inferSelect;
