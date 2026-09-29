/**
 * @file Table definition for the recurring meetings of a section.
 * @module @caa/db/tables/section-meeting
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  integer,
  pgTable,
  primaryKey,
  text,
  time,
  uuid,
} from 'drizzle-orm/pg-core';

import type { MeetingLocationKind, Weekday } from '@caa/domain';

import { campusTable } from './campus.table';
import { institutionTable } from './institution.table';
import { sectionTable } from './section.table';

/**
 * The `section_meeting` table: a section's meetings in order, written with its snapshot and
 * never changed.
 *
 * SAFETY: a null weekday list, time pair, or location means "to be announced": unknown, never
 * "no meeting" and never midnight. The checks keep a half-known time or location out.
 */
export const sectionMeetingTable = pgTable(
  'section_meeting',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    sectionId: uuid('section_id').notNull(),
    /** Zero-based position in the section's `meetings`, so they read back in order. */
    position: integer('position').notNull(),
    /** Days the meeting recurs on, or null when to be announced. */
    weekdays: text('weekdays').array().$type<Weekday[]>(),
    // NOTE: local wall-clock times in the snapshot's time zone, whole minutes only. The driver
    // returns `HH:MM:SS`; the mapper keeps `HH:MM`.
    /** Local start time, or null when to be announced. */
    startTime: time('start_time', { precision: 0 }),
    /** Local end time, exclusive, or null when to be announced. */
    endTime: time('end_time', { precision: 0 }),
    // NOTE: calendar dates in the institution's calendar (docs/standards/04 rule 7).
    startsOn: date('starts_on', { mode: 'string' }).notNull(),
    endsOn: date('ends_on', { mode: 'string' }).notNull(),
    /** Dates in the interval the meeting doesn't occur, such as a holiday. */
    excludedDates: date('excluded_dates', { mode: 'string' }).array().notNull(),
    /** `ON_CAMPUS` or `ONLINE`, or null when the location is to be announced. */
    locationKind: text('location_kind').$type<MeetingLocationKind>(),
    /** Campus of an on-campus meeting; null otherwise. */
    locationCampusId: uuid('location_campus_id'),
    /** Room display text of an on-campus meeting, or null when not assigned. */
    room: text('room'),
  },
  (table) => [
    primaryKey({
      name: 'section_meeting_pkey',
      columns: [table.tenantId, table.sectionId, table.position],
    }),
    // SECURITY: the section and the campus must be this tenant's.
    foreignKey({
      name: 'section_meeting_section_fk',
      columns: [table.tenantId, table.sectionId],
      foreignColumns: [sectionTable.tenantId, sectionTable.id],
    }),
    foreignKey({
      name: 'section_meeting_campus_fk',
      columns: [table.tenantId, table.locationCampusId],
      foreignColumns: [campusTable.tenantId, campusTable.id],
    }),
    check('section_meeting_position_nonnegative', sql`${table.position} >= 0`),
    check(
      'section_meeting_weekdays_known',
      sql`${table.weekdays} IS NULL OR (cardinality(${table.weekdays}) > 0
        AND ${table.weekdays} <@ ARRAY['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY',
          'SATURDAY', 'SUNDAY']::text[])`,
    ),
    // SAFETY: mirrors `MeetingPatternSchema`: both times or neither, and start before end.
    check(
      'section_meeting_time_range',
      sql`(${table.startTime} IS NULL AND ${table.endTime} IS NULL)
        OR (${table.startTime} IS NOT NULL AND ${table.endTime} IS NOT NULL
          AND ${table.startTime} < ${table.endTime})`,
    ),
    check('section_meeting_date_range', sql`${table.startsOn} <= ${table.endsOn}`),
    // SAFETY: an on-campus meeting names its campus; any other location has neither campus nor
    // room, so a location is never half-known.
    check(
      'section_meeting_location_shape',
      sql`(${table.locationKind} = 'ON_CAMPUS' AND ${table.locationCampusId} IS NOT NULL)
        OR (${table.locationKind} = 'ONLINE' AND ${table.locationCampusId} IS NULL
          AND ${table.room} IS NULL)
        OR (${table.locationKind} IS NULL AND ${table.locationCampusId} IS NULL
          AND ${table.room} IS NULL)`,
    ),
    check(
      'section_meeting_room_not_empty',
      sql`${table.room} IS NULL OR length(${table.room}) > 0`,
    ),
  ],
);

/** A row read from {@link sectionMeetingTable}. Never leaves this package. */
export type SectionMeetingRow = typeof sectionMeetingTable.$inferSelect;
