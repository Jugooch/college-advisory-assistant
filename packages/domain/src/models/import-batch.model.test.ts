/**
 * @file Tests for the import batch envelope.
 */
import { describe, expect, it } from 'vitest';

import { ImportOperation } from '../enums/import-operation.enum';
import { createImportBatch, type ImportBatchInput, ImportBatchSchema } from './import-batch.model';

const VALID: ImportBatchInput = {
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  sourceId: 'demo-sis',
  schemaVersion: '1.0.0',
  batchId: 'demo-batch-0001',
  extractedAt: '2026-09-25T06:00:00.000-05:00',
  sourceEffectiveAt: '2026-09-25T05:30:00.000-05:00',
  checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  recordCount: 3,
  operation: ImportOperation.Full,
};

describe('createImportBatch', () => {
  it('accepts a valid full-snapshot envelope', () => {
    expect(createImportBatch(VALID)).toEqual({
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      sourceId: 'demo-sis',
      schemaVersion: '1.0.0',
      batchId: 'demo-batch-0001',
      extractedAt: '2026-09-25T06:00:00.000-05:00',
      sourceEffectiveAt: '2026-09-25T05:30:00.000-05:00',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      recordCount: 3,
      operation: 'FULL',
    });
  });

  it('accepts a delta envelope', () => {
    expect(createImportBatch({ ...VALID, operation: ImportOperation.Delta }).operation).toBe(
      'DELTA',
    );
  });

  it('accepts an empty batch with a record count of zero', () => {
    expect(createImportBatch({ ...VALID, recordCount: 0 }).recordCount).toBe(0);
  });

  it('rejects a negative record count', () => {
    expect(() => createImportBatch({ ...VALID, recordCount: -1 })).toThrow();
  });

  it('rejects a fractional record count', () => {
    expect(() => createImportBatch({ ...VALID, recordCount: 2.5 })).toThrow();
  });

  it('rejects an uppercase hex checksum', () => {
    expect(() =>
      createImportBatch({
        ...VALID,
        checksum: 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855',
      }),
    ).toThrow(/SHA-256/);
  });

  it('rejects a checksum shorter than 64 characters', () => {
    expect(() => createImportBatch({ ...VALID, checksum: 'e3b0c442' })).toThrow(/SHA-256/);
  });

  it('rejects a checksum with non-hex characters', () => {
    expect(() =>
      createImportBatch({
        ...VALID,
        checksum: 'z3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      }),
    ).toThrow(/SHA-256/);
  });

  it('rejects an empty sourceId', () => {
    expect(() => createImportBatch({ ...VALID, sourceId: '' })).toThrow();
  });

  it('rejects an empty schemaVersion', () => {
    expect(() => createImportBatch({ ...VALID, schemaVersion: '' })).toThrow();
  });

  it('rejects an empty batchId', () => {
    expect(() => createImportBatch({ ...VALID, batchId: '' })).toThrow();
  });

  it('rejects an extractedAt without an offset', () => {
    expect(() => createImportBatch({ ...VALID, extractedAt: '2026-09-25T06:00:00' })).toThrow();
  });

  it('rejects a sourceEffectiveAt that is not an ISO datetime', () => {
    expect(() => createImportBatch({ ...VALID, sourceEffectiveAt: '25/09/2026' })).toThrow();
  });

  it('rejects a tenantId that is not a UUID', () => {
    expect(() => createImportBatch({ ...VALID, tenantId: 'demo-state' })).toThrow();
  });
});

describe('ImportBatchSchema', () => {
  it('rejects an unknown operation', () => {
    expect(ImportBatchSchema.safeParse({ ...VALID, operation: 'MERGE' }).success).toBe(false);
  });
});
