/**
 * @file Table definition for academic terms.
 * @module @caa/db/tables/term
 * @requirement FR-06
 * @requirement FR-09
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import { check, date, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { institutionTable } from './institution.table';

/**
 * The `term` table. Terms are ordered by `sequence`, never by `term_code`; both are unique
 * within a tenant, so a tenant's calendar has one position per term.
 */
export const termTable = pgTable(
  'term',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    termCode: text('term_code').notNull(),
    // NOTE: calendar dates in the institution's calendar, read as `YYYY-MM-DD` strings
    // (docs/standards/04 rule 7), never converted to instants.
    /** First day of the term. */
    startsOn: date('starts_on', { mode: 'string' }).notNull(),
    /** Last day of the term, inclusive. */
    endsOn: date('ends_on', { mode: 'string' }).notNull(),
    /** Position in the tenant's term order; a later term has a larger value. */
    sequence: integer('sequence').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('term_tenant_id_term_code_key').on(table.tenantId, table.termCode),
    // SAFETY: two terms at one position would leave "most recent" undefined.
    unique('term_tenant_id_sequence_key').on(table.tenantId, table.sequence),
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('term_tenant_id_id_key').on(table.tenantId, table.id),
    check('term_term_code_not_empty', sql`length(${table.termCode}) > 0`),
    check('term_date_range', sql`${table.startsOn} <= ${table.endsOn}`),
  ],
);

/** A row read from {@link termTable}. Never leaves this package. */
export type TermRow = typeof termTable.$inferSelect;
