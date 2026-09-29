/**
 * @file Table definition for a tenant's campuses, the sites section meetings take place at.
 * @module @caa/db/tables/campus
 * @requirement FR-07
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { institutionTable } from './institution.table';

/** The `campus` table. One row per source campus per tenant; the name is display only. */
export const campusTable = pgTable(
  'campus',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    sourceCampusId: text('source_campus_id').notNull(),
    /** Display name such as `North Campus`. Never used as identity. */
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('campus_tenant_id_source_campus_id_key').on(table.tenantId, table.sourceCampusId),
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('campus_tenant_id_id_key').on(table.tenantId, table.id),
    check(
      'campus_text_not_empty',
      sql`length(${table.sourceCampusId}) > 0 AND length(${table.name}) > 0`,
    ),
  ],
);

/** A row read from {@link campusTable}. Never leaves this package. */
export type CampusRow = typeof campusTable.$inferSelect;
