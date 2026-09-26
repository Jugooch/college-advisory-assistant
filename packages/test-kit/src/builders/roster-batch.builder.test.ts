/**
 * @file Tests for the synthetic roster batch builder. Expected digests were computed independently
 * with `printf ... | sha256sum`, not with test-kit code.
 */
import { describe, expect, it } from 'vitest';

import { ImportBatchSchema, ImportOperation, RosterRowSchema } from '@caa/domain';

import { buildRosterBatch } from './roster-batch.builder';

const TWO_ROWS = [
  { sourceStudentId: 'SYN-000001', recordVersion: 1, isDeleted: false },
  { sourceStudentId: 'SYN-000002', recordVersion: null, isDeleted: true },
];

describe('buildRosterBatch', () => {
  it('derives the checksum and record count from the given rows', () => {
    const { batch, rows } = buildRosterBatch({
      tenantId: '10000000-0000-4000-8000-000000000002',
      rows: TWO_ROWS,
      operation: ImportOperation.Delta,
    });

    expect(batch.checksum).toBe('6342c62a60b40b247a04af936f4e3a380e5465400adaf7897934c3a5e0302a3e');
    expect(batch.recordCount).toBe(2);
    expect(batch.tenantId).toBe('10000000-0000-4000-8000-000000000002');
    expect(batch.operation).toBe('DELTA');
    expect(rows).toEqual(TWO_ROWS);
  });

  it('defaults to a full snapshot of three rows in tenant A', () => {
    const { batch, rows } = buildRosterBatch();

    expect(rows.map((row) => row.sourceStudentId)).toEqual([
      'SYN-000001',
      'SYN-000002',
      'SYN-000003',
    ]);
    expect(batch.checksum).toBe('0b743a20bb51c936f841f71f938fe57f89db6de5e3e1a663fcd55b0eee116476');
    expect(batch.recordCount).toBe(3);
    expect(batch.tenantId).toBe('10000000-0000-4000-8000-000000000001');
    expect(batch.operation).toBe('FULL');
  });

  it('describes an empty batch with the empty-payload checksum and zero records', () => {
    const { batch, rows } = buildRosterBatch({ rows: [] });

    expect(rows).toEqual([]);
    expect(batch.checksum).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(batch.recordCount).toBe(0);
  });

  it('returns deep-equal batches for the same arguments', () => {
    expect(buildRosterBatch({ rows: TWO_ROWS })).toEqual(buildRosterBatch({ rows: TWO_ROWS }));
  });

  it('applies envelope overrides', () => {
    const { batch } = buildRosterBatch({ sourceId: 'sample-sis', batchId: 'cursor-0042' });

    expect(batch.sourceId).toBe('sample-sis');
    expect(batch.batchId).toBe('cursor-0042');
  });

  it('returns an envelope and rows that pass the domain schemas', () => {
    const { batch, rows } = buildRosterBatch({ rows: TWO_ROWS });

    expect(ImportBatchSchema.safeParse(batch).success).toBe(true);
    expect(rows.every((row) => RosterRowSchema.safeParse(row).success)).toBe(true);
  });

  it('rejects a row the domain forbids', () => {
    expect(() =>
      buildRosterBatch({ rows: [{ sourceStudentId: '', recordVersion: 1, isDeleted: false }] }),
    ).toThrow();
  });
});
