/**
 * @file Table definitions for versioned campus transition tables and their ordered campus pairs.
 * @module @caa/db/tables/campus-transition
 * @requirement FR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { campusTable } from './campus.table';
import { institutionTable } from './institution.table';

/**
 * The `campus_transition_version` table: one published version of a tenant's transition table.
 * A version with no pairs is valid and leaves every pair of different campuses unknown.
 */
export const campusTransitionVersionTable = pgTable(
  'campus_transition_version',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    /** The table's own version, pinned by schedule options as `campusTransitionVersion`. */
    version: text('version').notNull(),
    /** When the institution published this version. The latest one is current. */
    publishedAt: timestamp('published_at', { withTimezone: true, precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      name: 'campus_transition_version_pkey',
      columns: [table.tenantId, table.version],
    }),
    // SAFETY: two versions published at one time would leave "current" undefined.
    unique('campus_transition_version_published_key').on(table.tenantId, table.publishedAt),
    check('campus_transition_version_not_empty', sql`length(${table.version}) > 0`),
  ],
);

/**
 * The `campus_transition` table: minutes required from one campus to a different one, per
 * version. A pair that isn't listed is unknown, never zero (AC08).
 */
export const campusTransitionTable = pgTable(
  'campus_transition',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    version: text('version').notNull(),
    fromCampusId: uuid('from_campus_id').notNull(),
    toCampusId: uuid('to_campus_id').notNull(),
    /** Whole minutes required between the end of one meeting and the start of the next. */
    minutes: integer('minutes').notNull(),
  },
  (table) => [
    // SAFETY: one ordered pair per version, so a trip never has two required times.
    primaryKey({
      name: 'campus_transition_pkey',
      columns: [table.tenantId, table.version, table.fromCampusId, table.toCampusId],
    }),
    foreignKey({
      name: 'campus_transition_version_fk',
      columns: [table.tenantId, table.version],
      foreignColumns: [campusTransitionVersionTable.tenantId, campusTransitionVersionTable.version],
    }),
    // SECURITY: both campuses must be this tenant's.
    foreignKey({
      name: 'campus_transition_from_campus_fk',
      columns: [table.tenantId, table.fromCampusId],
      foreignColumns: [campusTable.tenantId, campusTable.id],
    }),
    foreignKey({
      name: 'campus_transition_to_campus_fk',
      columns: [table.tenantId, table.toCampusId],
      foreignColumns: [campusTable.tenantId, campusTable.id],
    }),
    // SAFETY: mirrors `CampusTransitionSchema`: the same campus needs no transition (ADR-0010).
    check(
      'campus_transition_different_campuses',
      sql`${table.fromCampusId} <> ${table.toCampusId}`,
    ),
    check('campus_transition_minutes_nonnegative', sql`${table.minutes} >= 0`),
  ],
);

/** A row read from {@link campusTransitionVersionTable}. Never leaves this package. */
export type CampusTransitionVersionRow = typeof campusTransitionVersionTable.$inferSelect;
/** A row read from {@link campusTransitionTable}. Never leaves this package. */
export type CampusTransitionRow = typeof campusTransitionTable.$inferSelect;
