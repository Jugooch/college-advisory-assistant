/**
 * @file Builds synthetic import batch envelopes for tests.
 * @module @caa/test-kit/builders/import-batch
 */
import {
  createImportBatch,
  type ImportBatch,
  type ImportBatchInput,
  ImportOperation,
} from '@caa/domain';

import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';
import { computeRosterChecksum } from '../serialization/roster-checksum';

/**
 * Builds a valid import batch envelope for an empty full snapshot in tenant A.
 *
 * The default `checksum` and `recordCount` describe zero rows. To get an envelope that matches
 * real rows, use `buildRosterBatch` instead of overriding them by hand.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated import batch envelope.
 */
export function buildImportBatch(overrides: Partial<ImportBatchInput> = {}): ImportBatch {
  return createImportBatch({
    tenantId: SYNTHETIC_TENANTS.a.id,
    sourceId: 'demo-sis',
    schemaVersion: '1.0.0',
    batchId: 'synthetic-batch-0001',
    extractedAt: '2026-09-25T06:00:00.000-05:00',
    sourceEffectiveAt: '2026-09-25T05:30:00.000-05:00',
    checksum: computeRosterChecksum([]),
    recordCount: 0,
    operation: ImportOperation.Full,
    ...overrides,
  });
}
