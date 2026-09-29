/**
 * @file Table definition for the sections of a published section snapshot.
 * @module @caa/db/tables/section
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import { check, date, foreignKey, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';

import type { SectionModality } from '@caa/domain';

import { campusTable } from './campus.table';
import { courseTable } from './course.table';
import { institutionTable } from './institution.table';
import { sectionSnapshotTable } from './section-snapshot.table';

/**
 * The `section` table. One row per section of one snapshot, written with the snapshot and never
 * changed. Section IDs are tenant-specific and belong to exactly one snapshot.
 */
export const sectionTable = pgTable(
  'section',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    sectionSnapshotId: uuid('section_snapshot_id').notNull(),
    /** Term of the snapshot; the foreign key makes them match. */
    termId: uuid('term_id').notNull(),
    courseId: uuid('course_id').notNull(),
    sourceSectionId: text('source_section_id').notNull(),
    /** Display code such as `001` or `L01`. Codes repeat across courses, so never identity. */
    sectionCode: text('section_code').notNull(),
    /** Home campus, or null when the section has none, as for an online section. */
    campusId: uuid('campus_id'),
    modality: text('modality').notNull().$type<SectionModality>(),
    // NOTE: calendar dates in the institution's calendar (docs/standards/04 rule 7).
    startsOn: date('starts_on', { mode: 'string' }).notNull(),
    endsOn: date('ends_on', { mode: 'string' }).notNull(),
  },
  (table) => [
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('section_tenant_id_id_key').on(table.tenantId, table.id),
    // SAFETY: target of the linked-section keys, so a link stays inside one snapshot and a
    // permitted section is checked against its component's course.
    unique('section_tenant_id_section_snapshot_id_id_course_id_key').on(
      table.tenantId,
      table.sectionSnapshotId,
      table.id,
      table.courseId,
    ),
    unique('section_tenant_id_section_snapshot_id_id_key').on(
      table.tenantId,
      table.sectionSnapshotId,
      table.id,
    ),
    // SAFETY: one source row gives one section per snapshot, never two meeting lists.
    unique('section_source_section_key').on(
      table.tenantId,
      table.sectionSnapshotId,
      table.sourceSectionId,
    ),
    // SAFETY: the section's term is its snapshot's term.
    foreignKey({
      name: 'section_snapshot_fk',
      columns: [table.tenantId, table.sectionSnapshotId, table.termId],
      foreignColumns: [
        sectionSnapshotTable.tenantId,
        sectionSnapshotTable.id,
        sectionSnapshotTable.termId,
      ],
    }),
    // SECURITY: the course and campus must be this tenant's.
    foreignKey({
      name: 'section_course_fk',
      columns: [table.tenantId, table.courseId],
      foreignColumns: [courseTable.tenantId, courseTable.id],
    }),
    foreignKey({
      name: 'section_campus_fk',
      columns: [table.tenantId, table.campusId],
      foreignColumns: [campusTable.tenantId, campusTable.id],
    }),
    check(
      'section_text_not_empty',
      sql`length(${table.sourceSectionId}) > 0 AND length(${table.sectionCode}) > 0`,
    ),
    check('section_date_range', sql`${table.startsOn} <= ${table.endsOn}`),
    check(
      'section_modality_known',
      sql`${table.modality} IN ('IN_PERSON', 'HYBRID', 'ONLINE_SYNCHRONOUS', 'ONLINE_ASYNCHRONOUS')`,
    ),
    // SAFETY: mirrors `SectionSchema`: an in-person or hybrid section names its campus.
    check(
      'section_in_person_has_campus',
      sql`${table.campusId} IS NOT NULL OR ${table.modality} NOT IN ('IN_PERSON', 'HYBRID')`,
    ),
  ],
);

/** A row read from {@link sectionTable}. Never leaves this package. */
export type SectionRow = typeof sectionTable.$inferSelect;
