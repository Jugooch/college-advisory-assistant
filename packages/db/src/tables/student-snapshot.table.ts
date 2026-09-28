/**
 * @file Table definition for student snapshots (immutable revisions of a student's record).
 * @module @caa/db/tables/student-snapshot
 * @requirement FR-03
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
import { studentTable } from './student.table';

/**
 * The `student_snapshot` table. One row per record revision; a refreshed record is a new row,
 * never an update. Attempts join through `student_snapshot_attempt`.
 */
export const studentSnapshotTable = pgTable(
  'student_snapshot',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    studentId: uuid('student_id').notNull(),
    // NOTE: no foreign key yet; programs aren't persisted, so the ID is validated by the mapper.
    /** Official program in the source record, or null when the source didn't supply one. */
    programId: uuid('program_id'),
    /** Catalog label such as `2025-2026`, or null when the source didn't supply one. */
    catalogYear: text('catalog_year'),
    // NOTE: millisecond precision, the same as the domain's ISO strings, so the "latest" tie
    // check in the repository sees exactly the order PostgreSQL sorts by.
    /** Point in time the source record describes. "Latest" is judged by this. */
    sourceEffectiveAt: timestamp('source_effective_at', {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    /** When the record was ingested. Breaks ties between equal source times only. */
    ingestedAt: timestamp('ingested_at', { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('student_snapshot_tenant_id_id_key').on(table.tenantId, table.id),
    // SAFETY: target for links that must also match the student, so a snapshot can't list
    // another student's attempt and an audit can't pin another student's record.
    unique('student_snapshot_tenant_id_student_id_id_key').on(
      table.tenantId,
      table.studentId,
      table.id,
    ),
    foreignKey({
      name: 'student_snapshot_student_fk',
      columns: [table.tenantId, table.studentId],
      foreignColumns: [studentTable.tenantId, studentTable.id],
    }),
    check(
      'student_snapshot_catalog_year_not_empty',
      sql`${table.catalogYear} IS NULL OR length(${table.catalogYear}) > 0`,
    ),
    check(
      'student_snapshot_effective_before_ingested',
      sql`${table.sourceEffectiveAt} <= ${table.ingestedAt}`,
    ),
    index('student_snapshot_latest_idx').on(
      table.tenantId,
      table.studentId,
      table.sourceEffectiveAt,
      table.ingestedAt,
    ),
  ],
);

/** A row read from {@link studentSnapshotTable}. Never leaves this package. */
export type StudentSnapshotRow = typeof studentSnapshotTable.$inferSelect;
