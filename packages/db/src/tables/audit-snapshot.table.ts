/**
 * @file Table definition for audit snapshots (immutable degree audit revisions).
 * @module @caa/db/tables/audit-snapshot
 * @requirement FR-04
 * @requirement FR-05
 * @requirement NFR-01
 * @see docs/planning/07-system-architecture-and-design.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { institutionTable } from './institution.table';
import { studentSnapshotTable } from './student-snapshot.table';

/**
 * The `audit_snapshot` table. One row per audit run; a re-run audit is a new row, never an
 * update. Requirements are in `requirement_result`.
 */
export const auditSnapshotTable = pgTable(
  'audit_snapshot',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    studentId: uuid('student_id').notNull(),
    /** Student snapshot the audit ran against. Pinned: a newer snapshot never changes it. */
    studentSnapshotId: uuid('student_snapshot_id').notNull(),
    // NOTE: no foreign key yet; programs aren't persisted, so the ID is validated by the mapper.
    programId: uuid('program_id').notNull(),
    auditSource: text('audit_source').notNull(),
    /** The audit system's run or revision ID, for example `audit_demo_r7`. */
    auditVersion: text('audit_version').notNull(),
    catalogYear: text('catalog_year').notNull(),
    // NOTE: millisecond precision, matching the repository's "latest" tie check.
    /** When the audit system generated the audit. "Latest" is judged by this. */
    generatedAt: timestamp('generated_at', { withTimezone: true, precision: 3 }).notNull(),
    /** Point in time of the student record the audit system ran against. */
    studentRecordEffectiveAt: timestamp('student_record_effective_at', {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    /** When the audit was ingested. Bookkeeping only; never used to order revisions. */
    ingestedAt: timestamp('ingested_at', { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('audit_snapshot_tenant_id_id_key').on(table.tenantId, table.id),
    // NOTE: one row per audit run, so re-importing the same run can't create a second copy.
    unique('audit_snapshot_run_key').on(
      table.tenantId,
      table.studentId,
      table.auditSource,
      table.auditVersion,
    ),
    // SAFETY: the pinned snapshot must be this tenant's and this student's record.
    foreignKey({
      name: 'audit_snapshot_student_snapshot_fk',
      columns: [table.tenantId, table.studentId, table.studentSnapshotId],
      foreignColumns: [
        studentSnapshotTable.tenantId,
        studentSnapshotTable.studentId,
        studentSnapshotTable.id,
      ],
    }),
    check(
      'audit_snapshot_text_not_empty',
      sql`length(${table.auditSource}) > 0 AND length(${table.auditVersion}) > 0
        AND length(${table.catalogYear}) > 0`,
    ),
    check(
      'audit_snapshot_record_before_generated',
      sql`${table.studentRecordEffectiveAt} <= ${table.generatedAt}`,
    ),
    index('audit_snapshot_latest_idx').on(table.tenantId, table.studentId, table.generatedAt),
  ],
);

/** A row read from {@link auditSnapshotTable}. Never leaves this package. */
export type AuditSnapshotRow = typeof auditSnapshotTable.$inferSelect;
