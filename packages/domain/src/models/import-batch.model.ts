/**
 * @file Import batch envelope: the metadata every source import carries before it can be published.
 * @module @caa/domain/models/import-batch
 * @requirement FR-03
 * @requirement NFR-04
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { ImportOperationSchema } from '../enums/import-operation.enum';
import { InstitutionIdSchema } from './institution.model';

/** Schema for a SHA-256 digest written as 64 lowercase hexadecimal characters. */
export const Sha256HexSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'Expected a 64-character lowercase hex SHA-256 digest');

/**
 * Schema for an import batch envelope.
 *
 * The idempotency key is `tenantId` + `sourceId` + `batchId`. A repeat of that key with a
 * different `checksum` is a conflict, never a silent replacement.
 */
export const ImportBatchSchema = z
  .object({
    tenantId: InstitutionIdSchema,
    /** Configured source system the batch came from, for example `demo-sis`. */
    sourceId: z.string().min(1),
    /** Version of the source row schema the batch was extracted with. */
    schemaVersion: z.string().min(1),
    /** Source-supplied cursor or batch identifier. Plain string; not an internal ID. */
    batchId: z.string().min(1),
    /** When the source extract ran. ISO 8601 with offset. */
    extractedAt: z.iso.datetime({ offset: true }),
    /** Point in time the source data describes. ISO 8601 with offset. Drives freshness. */
    sourceEffectiveAt: z.iso.datetime({ offset: true }),
    /** SHA-256 of the batch payload, lowercase hex. */
    checksum: Sha256HexSchema,
    /** Number of rows in the batch, including tombstones. */
    recordCount: z.number().int().nonnegative(),
    operation: ImportOperationSchema,
  })
  .readonly();

/** A validated, immutable import batch envelope. */
export type ImportBatch = z.infer<typeof ImportBatchSchema>;

/** Raw input accepted by {@link createImportBatch}. */
export type ImportBatchInput = z.input<typeof ImportBatchSchema>;

/**
 * Creates a validated, immutable import batch envelope.
 *
 * @param input - Raw envelope fields.
 * @returns The parsed import batch envelope.
 * @throws {z.ZodError} When a field is invalid, the checksum is not a lowercase hex SHA-256
 *   digest, or the record count is negative or not an integer.
 */
export function createImportBatch(input: ImportBatchInput): ImportBatch {
  return ImportBatchSchema.parse(input);
}
