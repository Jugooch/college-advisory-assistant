/**
 * @file Converts import batch rows into domain envelopes.
 * @module @caa/db/mappers/import-batch
 * @requirement FR-03
 */
import { createImportBatch, type ImportBatch } from '@caa/domain';

import type { ImportBatchRow } from '../tables/import-batch.table';

/**
 * Maps a database row to a validated import batch envelope. The outcome columns (status,
 * rejected count, ingestion time) stay in the database.
 *
 * @param row - Row read from the `import_batch` table.
 * @returns The domain import batch envelope, with timestamps as ISO strings.
 * @throws {z.ZodError} When the stored row violates the domain schema.
 */
export function toImportBatch(row: ImportBatchRow): ImportBatch {
  return createImportBatch({
    tenantId: row.tenantId,
    sourceId: row.sourceId,
    schemaVersion: row.schemaVersion,
    batchId: row.batchId,
    extractedAt: row.extractedAt.toISOString(),
    sourceEffectiveAt: row.sourceEffectiveAt.toISOString(),
    checksum: row.checksum,
    recordCount: row.recordCount,
    operation: row.operation,
  });
}
