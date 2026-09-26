/**
 * @file Table definition for import batch envelopes and their outcome.
 * @module @caa/db/tables/import-batch
 * @requirement FR-03
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import type { ImportBatchStatus, ImportOperation } from '@caa/domain';

import { institutionTable } from './institution.table';

/** The `import_batch` table. The idempotency key is tenant + source + batch ID. */
export const importBatchTable = pgTable(
  'import_batch',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    sourceId: text('source_id').notNull(),
    schemaVersion: text('schema_version').notNull(),
    batchId: text('batch_id').notNull(),
    extractedAt: timestamp('extracted_at', { withTimezone: true }).notNull(),
    sourceEffectiveAt: timestamp('source_effective_at', { withTimezone: true }).notNull(),
    /** SHA-256 of the batch payload, lowercase hex. */
    checksum: text('checksum').notNull(),
    recordCount: integer('record_count').notNull(),
    operation: text('operation').notNull().$type<ImportOperation>(),
    status: text('status').notNull().$type<ImportBatchStatus>(),
    /** Number of rows set aside in `import_quarantine`. */
    rejectedCount: integer('rejected_count').notNull(),
    /** When this app recorded the batch, as opposed to the source's effective time. */
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('import_batch_tenant_id_source_id_batch_id_key').on(
      table.tenantId,
      table.sourceId,
      table.batchId,
    ),
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('import_batch_tenant_id_id_key').on(table.tenantId, table.id),
    check('import_batch_record_count_nonnegative', sql`${table.recordCount} >= 0`),
    check('import_batch_rejected_count_nonnegative', sql`${table.rejectedCount} >= 0`),
  ],
);

/** A row read from {@link importBatchTable}. Never leaves this package. */
export type ImportBatchRow = typeof importBatchTable.$inferSelect;
