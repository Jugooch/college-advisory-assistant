/**
 * @file Table definitions for linked-section groups, their components, and permitted members.
 * @module @caa/db/tables/section-link-group
 * @requirement FR-07
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { courseTable } from './course.table';
import { institutionTable } from './institution.table';
import { sectionTable } from './section.table';

/**
 * The `section_link_group` table: a primary section whose selection requires every component.
 * Written with its snapshot and never changed; the keys keep it inside one snapshot.
 */
export const sectionLinkGroupTable = pgTable(
  'section_link_group',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    sectionSnapshotId: uuid('section_snapshot_id').notNull(),
    primarySectionId: uuid('primary_section_id').notNull(),
  },
  (table) => [
    unique('section_link_group_tenant_id_section_snapshot_id_id_key').on(
      table.tenantId,
      table.sectionSnapshotId,
      table.id,
    ),
    // SAFETY: two groups for one primary section would leave its components ambiguous.
    unique('section_link_group_primary_key').on(
      table.tenantId,
      table.sectionSnapshotId,
      table.primarySectionId,
    ),
    // SECURITY: the primary section is a section of this tenant's snapshot.
    foreignKey({
      name: 'section_link_group_primary_fk',
      columns: [table.tenantId, table.sectionSnapshotId, table.primarySectionId],
      foreignColumns: [sectionTable.tenantId, sectionTable.sectionSnapshotId, sectionTable.id],
    }),
  ],
);

/**
 * The `section_link_component` table: one required component of a group, in order. The student
 * takes exactly one of its permitted sections; an empty list is valid data (UNKNOWN).
 */
export const sectionLinkComponentTable = pgTable(
  'section_link_component',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    sectionSnapshotId: uuid('section_snapshot_id').notNull(),
    groupId: uuid('group_id').notNull(),
    /** Zero-based position in the group's `components`. */
    position: integer('position').notNull(),
    /** Display name such as `Lab`. Never used as identity. */
    name: text('name').notNull(),
    /** Course every permitted section belongs to. */
    courseId: uuid('course_id').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'section_link_component_pkey',
      columns: [table.tenantId, table.groupId, table.position],
    }),
    // SAFETY: target of the member key, so a member is checked against its component's course.
    unique('section_link_component_course_key').on(
      table.tenantId,
      table.sectionSnapshotId,
      table.groupId,
      table.position,
      table.courseId,
    ),
    foreignKey({
      name: 'section_link_component_group_fk',
      columns: [table.tenantId, table.sectionSnapshotId, table.groupId],
      foreignColumns: [
        sectionLinkGroupTable.tenantId,
        sectionLinkGroupTable.sectionSnapshotId,
        sectionLinkGroupTable.id,
      ],
    }),
    foreignKey({
      name: 'section_link_component_course_fk',
      columns: [table.tenantId, table.courseId],
      foreignColumns: [courseTable.tenantId, courseTable.id],
    }),
    check('section_link_component_position_nonnegative', sql`${table.position} >= 0`),
    check('section_link_component_name_not_empty', sql`length(${table.name}) > 0`),
  ],
);

/** The `section_link_member` table: a section a component permits, in the component's order. */
export const sectionLinkMemberTable = pgTable(
  'section_link_member',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    sectionSnapshotId: uuid('section_snapshot_id').notNull(),
    groupId: uuid('group_id').notNull(),
    componentPosition: integer('component_position').notNull(),
    /** The component's course; the keys make it the section's course too. */
    courseId: uuid('course_id').notNull(),
    sectionId: uuid('section_id').notNull(),
    /** Zero-based position in the component's `permittedSectionIds`. */
    position: integer('position').notNull(),
  },
  (table) => [
    // SAFETY: a section permitted by two components would let one selection meet two of them.
    primaryKey({
      name: 'section_link_member_pkey',
      columns: [table.tenantId, table.groupId, table.sectionId],
    }),
    unique('section_link_member_position_key').on(
      table.tenantId,
      table.groupId,
      table.componentPosition,
      table.position,
    ),
    foreignKey({
      name: 'section_link_member_component_fk',
      columns: [
        table.tenantId,
        table.sectionSnapshotId,
        table.groupId,
        table.componentPosition,
        table.courseId,
      ],
      foreignColumns: [
        sectionLinkComponentTable.tenantId,
        sectionLinkComponentTable.sectionSnapshotId,
        sectionLinkComponentTable.groupId,
        sectionLinkComponentTable.position,
        sectionLinkComponentTable.courseId,
      ],
    }),
    // SAFETY: a permitted section is in the same snapshot and belongs to the component's course.
    foreignKey({
      name: 'section_link_member_section_fk',
      columns: [table.tenantId, table.sectionSnapshotId, table.sectionId, table.courseId],
      foreignColumns: [
        sectionTable.tenantId,
        sectionTable.sectionSnapshotId,
        sectionTable.id,
        sectionTable.courseId,
      ],
    }),
    check('section_link_member_position_nonnegative', sql`${table.position} >= 0`),
  ],
);

/** A row read from {@link sectionLinkGroupTable}. Never leaves this package. */
export type SectionLinkGroupRow = typeof sectionLinkGroupTable.$inferSelect;
/** A row read from {@link sectionLinkComponentTable}. Never leaves this package. */
export type SectionLinkComponentRow = typeof sectionLinkComponentTable.$inferSelect;
/** A row read from {@link sectionLinkMemberTable}. Never leaves this package. */
export type SectionLinkMemberRow = typeof sectionLinkMemberTable.$inferSelect;
