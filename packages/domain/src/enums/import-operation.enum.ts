/**
 * @file Whether an import batch is a full snapshot or a delta.
 * @module @caa/domain/enums/import-operation
 * @requirement FR-03
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

/**
 * Operation type of an import batch.
 *
 * A record missing from a `DELTA` is unchanged, not deleted. Removals come only from row
 * tombstones or from reconciling a completed `FULL` snapshot.
 */
export const ImportOperation = {
  Full: 'FULL',
  Delta: 'DELTA',
} as const;

/** Union of every {@link ImportOperation} value. */
export type ImportOperation = (typeof ImportOperation)[keyof typeof ImportOperation];

/** Runtime schema for {@link ImportOperation}. */
export const ImportOperationSchema = z.enum(ImportOperation);
