/**
 * @file Table definition for import rows set aside because they failed validation.
 * @module @caa/db/tables/import-quarantine
 * @requirement FR-03
 * @see docs/planning/09-data-model-and-integration-contracts.md
 * @see docs/planning/07-system-architecture-and-design.md
 */
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { importBatchTable } from './import-batch.table';
import { institutionTable } from './institution.table';

/**
 * The `import_quarantine` table. One row per rejected source row.
 *
 * SECURITY: stores a position, the source record ID, and a reason, never the raw row payload,
 * so malformed input can't smuggle personal data past validation.
 */
export const importQuarantineTable = pgTable(
  'import_quarantine',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    importBatchId: uuid('import_batch_id').notNull(),
    /** Zero-based position of the row in the batch. */
    rowIndex: integer('row_index').notNull(),
    /** Source record ID when it could be read, or null when the row was too malformed. */
    sourceRecordId: text('source_record_id'),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('import_quarantine_tenant_id_id_key').on(table.tenantId, table.id),
    foreignKey({
      name: 'import_quarantine_batch_fk',
      columns: [table.tenantId, table.importBatchId],
      foreignColumns: [importBatchTable.tenantId, importBatchTable.id],
    }),
    check('import_quarantine_row_index_nonnegative', sql`${table.rowIndex} >= 0`),
    check('import_quarantine_reason_not_empty', sql`length(${table.reason}) > 0`),
  ],
);

/** A row read from {@link importQuarantineTable}. Never leaves this package. */
export type ImportQuarantineRow = typeof importQuarantineTable.$inferSelect;
