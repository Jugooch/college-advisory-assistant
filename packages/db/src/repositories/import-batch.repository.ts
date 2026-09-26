/**
 * @file Read-only data access for recorded import batches.
 * @module @caa/db/repositories/import-batch
 * @requirement FR-03
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { and, desc, eq } from 'drizzle-orm';

import { type ImportBatch, ImportBatchStatus, type InstitutionId } from '@caa/domain';

import type { Database } from '../client';
import { toImportBatch } from '../mappers/import-batch.mapper';
import { importBatchTable } from '../tables/import-batch.table';

/** Reads import batches. Batches are written only through the roster repository. */
export interface ImportBatchRepository {
  /**
   * Finds a batch by its idempotency key, whatever its status.
   *
   * @param tenantId - Tenant the batch was imported for.
   * @param sourceId - Configured source system.
   * @param batchId - Source-supplied batch identifier.
   * @returns The recorded envelope (compare its checksum to detect a conflict), or null.
   */
  findByKey(
    tenantId: InstitutionId,
    sourceId: string,
    batchId: string,
  ): Promise<ImportBatch | null>;

  /**
   * Finds the source effective time of the newest published batch from a source.
   *
   * @param tenantId - Tenant the batches were imported for.
   * @param sourceId - Configured source system.
   * @returns ISO 8601 instant, or null when nothing from the source has been published.
   */
  findLatestPublishedEffectiveAt(tenantId: InstitutionId, sourceId: string): Promise<string | null>;
}

/**
 * Creates the import batch repository.
 *
 * @param db - Typed database handle.
 * @returns An {@link ImportBatchRepository}.
 */
export function createImportBatchRepository(db: Database): ImportBatchRepository {
  const table = importBatchTable;
  return {
    async findByKey(tenantId, sourceId, batchId) {
      const rows = await db
        .select()
        .from(table)
        .where(
          and(
            eq(table.tenantId, tenantId),
            eq(table.sourceId, sourceId),
            eq(table.batchId, batchId),
          ),
        )
        .limit(1);
      const row = rows[0];
      return row ? toImportBatch(row) : null;
    },

    async findLatestPublishedEffectiveAt(tenantId, sourceId) {
      // SAFETY: quarantined batches never count; only published data defines "newer truth".
      const rows = await db
        .select({ sourceEffectiveAt: table.sourceEffectiveAt })
        .from(table)
        .where(
          and(
            eq(table.tenantId, tenantId),
            eq(table.sourceId, sourceId),
            eq(table.status, ImportBatchStatus.Published),
          ),
        )
        .orderBy(desc(table.sourceEffectiveAt))
        .limit(1);
      const row = rows[0];
      return row ? row.sourceEffectiveAt.toISOString() : null;
    },
  };
}
