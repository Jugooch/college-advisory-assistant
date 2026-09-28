/**
 * @file Table definition for equivalency groups (courses the institution treats as equivalent).
 * @module @caa/db/tables/equivalency-group
 * @requirement FR-06
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { institutionTable } from './institution.table';

/** The `equivalency_group` table. Courses join a group through `course.equivalency_group_id`. */
export const equivalencyGroupTable = pgTable(
  'equivalency_group',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    /** Group identifier in the source system. Distinct from the internal ID. */
    sourceEquivalencyGroupId: text('source_equivalency_group_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('equivalency_group_tenant_id_source_equivalency_group_id_key').on(
      table.tenantId,
      table.sourceEquivalencyGroupId,
    ),
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('equivalency_group_tenant_id_id_key').on(table.tenantId, table.id),
    check(
      'equivalency_group_source_id_not_empty',
      sql`length(${table.sourceEquivalencyGroupId}) > 0`,
    ),
  ],
);

/** A row read from {@link equivalencyGroupTable}. Never leaves this package. */
export type EquivalencyGroupRow = typeof equivalencyGroupTable.$inferSelect;
