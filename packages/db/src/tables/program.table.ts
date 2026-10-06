/**
 * @file Table definition for catalog academic programs.
 * @module @caa/db/tables/program
 * @requirement FR-10
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { institutionTable } from './institution.table';

/** The `program` table. One row per source program per tenant, as the catalog names it. */
export const programTable = pgTable(
  'program',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    sourceProgramId: text('source_program_id').notNull(),
    /** Catalog name such as `B.S. Physics`, or null when the catalog supplies none. */
    name: text('name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('program_tenant_id_source_program_id_key').on(table.tenantId, table.sourceProgramId),
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('program_tenant_id_id_key').on(table.tenantId, table.id),
    check('program_source_program_id_not_empty', sql`length(${table.sourceProgramId}) > 0`),
    // SAFETY: unknown is an explicit null, never an empty name.
    check('program_name_not_empty', sql`${table.name} IS NULL OR length(${table.name}) > 0`),
  ],
);

/** A row read from {@link programTable}. Never leaves this package. */
export type ProgramRow = typeof programTable.$inferSelect;
