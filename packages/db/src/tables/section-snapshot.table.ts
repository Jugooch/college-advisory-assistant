/**
 * @file Table definition for published section snapshots: one term's sections as of a feed time.
 * @module @caa/db/tables/section-snapshot
 * @requirement FR-07
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { institutionTable } from './institution.table';
import { termTable } from './term.table';

/**
 * The `section_snapshot` table. One row per published snapshot of a term. Published snapshots
 * are immutable: a newer feed is a new snapshot, and a trigger rejects UPDATE, DELETE and
 * TRUNCATE (migration `0004_section_persistence`, the #116 pattern).
 */
export const sectionSnapshotTable = pgTable(
  'section_snapshot',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    termId: uuid('term_id').notNull(),
    // NOTE: calendar dates in the institution's calendar, read as `YYYY-MM-DD` strings
    // (docs/standards/04 rule 7). Copied from the term when published, so the pinned snapshot
    // doesn't change if the term record does.
    /** First day of the term. */
    termStartsOn: date('term_starts_on', { mode: 'string' }).notNull(),
    /** Last day of the term, inclusive. */
    termEndsOn: date('term_ends_on', { mode: 'string' }).notNull(),
    /** IANA time zone every meeting time is local to. */
    timezone: text('timezone').notNull(),
    // NOTE: millisecond precision, matching the repository's "latest" tie check.
    /** When the registrar feed's data took effect. "Latest" is judged by this. */
    sourceEffectiveAt: timestamp('source_effective_at', {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    /** When the snapshot was stored. Bookkeeping only; never used to order snapshots. */
    ingestedAt: timestamp('ingested_at', { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('section_snapshot_tenant_id_id_key').on(table.tenantId, table.id),
    // SAFETY: target of the section key, so a section's term is its snapshot's term.
    unique('section_snapshot_tenant_id_id_term_id_key').on(table.tenantId, table.id, table.termId),
    // SECURITY: the term must be this tenant's.
    foreignKey({
      name: 'section_snapshot_term_fk',
      columns: [table.tenantId, table.termId],
      foreignColumns: [termTable.tenantId, termTable.id],
    }),
    check('section_snapshot_term_date_range', sql`${table.termStartsOn} <= ${table.termEndsOn}`),
    check('section_snapshot_timezone_not_empty', sql`length(${table.timezone}) > 0`),
    index('section_snapshot_latest_idx').on(table.tenantId, table.termId, table.sourceEffectiveAt),
  ],
);

/** A row read from {@link sectionSnapshotTable}. Never leaves this package. */
export type SectionSnapshotRow = typeof sectionSnapshotTable.$inferSelect;
