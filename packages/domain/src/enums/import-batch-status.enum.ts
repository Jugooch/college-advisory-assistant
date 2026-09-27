/**
 * @file Outcome of validating an import batch.
 * @module @caa/domain/enums/import-batch-status
 * @requirement FR-03
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

/** Outcome of validating an import batch. Only a published batch is visible to readers. */
export const ImportBatchStatus = {
  /** Validated and published atomically. */
  Published: 'PUBLISHED',
  /** Failed validation. Held back so readers never see half a batch. */
  Quarantined: 'QUARANTINED',
  /** Same tenant, source, and batch ID as an earlier batch, but a different checksum. */
  Conflict: 'CONFLICT',
} as const;

/** Union of every {@link ImportBatchStatus} value. */
export type ImportBatchStatus = (typeof ImportBatchStatus)[keyof typeof ImportBatchStatus];

/** Runtime schema for {@link ImportBatchStatus}. */
export const ImportBatchStatusSchema = z.enum(ImportBatchStatus);
