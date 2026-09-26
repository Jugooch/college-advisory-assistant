/**
 * @file Tests for the import batch row mapper.
 */
import { describe, expect, it } from 'vitest';

import { ImportBatchStatus, ImportOperation } from '@caa/domain';

import type { ImportBatchRow } from '../tables/import-batch.table';
import { toImportBatch } from './import-batch.mapper';

const ROW: ImportBatchRow = {
  id: '2b3c4d5e-6f70-4a81-9b2c-3d4e5f607182',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  sourceId: 'demo-sis',
  schemaVersion: '1',
  batchId: 'batch-0001',
  extractedAt: new Date('2026-09-25T07:00:00.000Z'),
  sourceEffectiveAt: new Date('2026-09-25T06:00:00.000Z'),
  checksum: 'a'.repeat(64),
  recordCount: 2,
  operation: ImportOperation.Delta,
  status: ImportBatchStatus.Published,
  rejectedCount: 0,
  ingestedAt: new Date('2026-09-25T07:05:00.000Z'),
};

describe('toImportBatch', () => {
  it('rebuilds the envelope with ISO timestamps', () => {
    const batch = toImportBatch(ROW);

    expect(batch).toEqual({
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      sourceId: 'demo-sis',
      schemaVersion: '1',
      batchId: 'batch-0001',
      extractedAt: '2026-09-25T07:00:00.000Z',
      sourceEffectiveAt: '2026-09-25T06:00:00.000Z',
      checksum: 'a'.repeat(64),
      recordCount: 2,
      operation: ImportOperation.Delta,
    });
  });
});
