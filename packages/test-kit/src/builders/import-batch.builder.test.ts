/**
 * @file Tests for the synthetic import batch envelope builder.
 */
import { describe, expect, it } from 'vitest';

import { ImportBatchSchema, ImportOperation } from '@caa/domain';

import { buildImportBatch } from './import-batch.builder';

describe('buildImportBatch', () => {
  it('defaults to an empty full snapshot in tenant A', () => {
    expect(buildImportBatch()).toEqual({
      tenantId: '10000000-0000-4000-8000-000000000001',
      sourceId: 'demo-sis',
      schemaVersion: '1.0.0',
      batchId: 'synthetic-batch-0001',
      extractedAt: '2026-09-25T06:00:00.000-05:00',
      sourceEffectiveAt: '2026-09-25T05:30:00.000-05:00',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      recordCount: 0,
      operation: 'FULL',
    });
  });

  it('returns deep-equal envelopes for the same arguments', () => {
    expect(buildImportBatch({ batchId: 'synthetic-batch-0002' })).toEqual(
      buildImportBatch({ batchId: 'synthetic-batch-0002' }),
    );
  });

  it('applies overrides', () => {
    const batch = buildImportBatch({
      tenantId: '10000000-0000-4000-8000-000000000002',
      operation: ImportOperation.Delta,
    });

    expect(batch.tenantId).toBe('10000000-0000-4000-8000-000000000002');
    expect(batch.operation).toBe('DELTA');
  });

  it('returns an envelope that passes the domain schema', () => {
    expect(ImportBatchSchema.safeParse(buildImportBatch()).success).toBe(true);
  });

  it('rejects overrides the domain forbids', () => {
    expect(() => buildImportBatch({ checksum: 'NOT-A-DIGEST' })).toThrow();
  });
});
