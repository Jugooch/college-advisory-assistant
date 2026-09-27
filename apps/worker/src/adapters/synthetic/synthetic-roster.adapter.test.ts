/**
 * @file Tests for the synthetic roster adapter: envelope checks, count and checksum, and row quarantine.
 */
import { describe, expect, it } from 'vitest';

import type { RosterRowInput } from '@caa/domain';
import {
  buildImportBatch,
  buildRosterBatch,
  buildRosterRow,
  computeRosterChecksum,
  SYNTHETIC_TENANTS,
} from '@caa/test-kit';

import { parseSyntheticRoster } from './synthetic-roster.adapter';

const EXPECTED = { tenantId: SYNTHETIC_TENANTS.a.id, sourceId: 'demo-sis' };

/**
 * Builds a document whose envelope checksum and count match rows that may be invalid.
 *
 * @param rows - Raw rows, valid or not.
 * @returns A `{ batch, rows }` document.
 */
function documentWithRows(rows: readonly RosterRowInput[]): unknown {
  const batch = buildImportBatch({
    checksum: computeRosterChecksum(rows),
    recordCount: rows.length,
  });
  return { batch, rows };
}

describe('parseSyntheticRoster', () => {
  it('returns the envelope and every valid row in batch order', () => {
    const document = buildRosterBatch();

    const result = parseSyntheticRoster(document, EXPECTED);

    expect(result).toEqual({
      isValid: true,
      batch: document.batch,
      rows: document.rows,
      quarantined: [],
    });
  });

  it.each([null, 'text', { batch: buildImportBatch() }, { batch: buildImportBatch(), rows: {} }])(
    'rejects a malformed document (%#)',
    (document) => {
      expect(parseSyntheticRoster(document, EXPECTED)).toEqual({
        isValid: false,
        reason: 'malformed_document',
      });
    },
  );

  it('rejects an envelope that fails the domain schema', () => {
    const { batch, rows } = buildRosterBatch();

    const result = parseSyntheticRoster({ batch: { ...batch, checksum: 'ABC' }, rows }, EXPECTED);

    expect(result).toEqual({ isValid: false, reason: 'invalid_envelope' });
  });

  it('rejects a batch for another tenant than the job imports for', () => {
    const document = buildRosterBatch({ tenantId: SYNTHETIC_TENANTS.b.id });

    expect(parseSyntheticRoster(document, EXPECTED)).toEqual({
      isValid: false,
      reason: 'tenant_mismatch',
    });
  });

  it('rejects a batch from another source than the job imports from', () => {
    const document = buildRosterBatch({ sourceId: 'other-sis' });

    expect(parseSyntheticRoster(document, EXPECTED)).toEqual({
      isValid: false,
      reason: 'source_mismatch',
    });
  });

  it('rejects a schema version the adapter does not understand', () => {
    const document = buildRosterBatch({ schemaVersion: '2.0.0' });

    expect(parseSyntheticRoster(document, EXPECTED)).toEqual({
      isValid: false,
      reason: 'unsupported_schema_version',
    });
  });

  it('rejects a batch whose record count differs from its rows', () => {
    const { batch, rows } = buildRosterBatch();

    const result = parseSyntheticRoster({ batch, rows: rows.slice(1) }, EXPECTED);

    expect(result).toEqual({ isValid: false, reason: 'record_count_mismatch' });
  });

  it('rejects a batch whose rows do not match its checksum', () => {
    const { batch, rows } = buildRosterBatch();
    const tampered = [buildRosterRow({ isDeleted: true }, 1), ...rows.slice(1)];

    const result = parseSyntheticRoster({ batch, rows: tampered }, EXPECTED);

    expect(result).toEqual({ isValid: false, reason: 'checksum_mismatch' });
  });

  it('quarantines invalid rows by position and failing field, keeping the valid ones', () => {
    const valid = buildRosterRow({}, 1);
    const document = documentWithRows([
      valid,
      { sourceStudentId: '', recordVersion: 1, isDeleted: false },
      { sourceStudentId: 'SYN-000003', recordVersion: 1.5, isDeleted: false },
    ]);

    const result = parseSyntheticRoster(document, EXPECTED);

    expect(result).toMatchObject({
      isValid: true,
      rows: [valid],
      quarantined: [
        { rowIndex: 1, sourceRecordId: null, reason: 'invalid_field:sourceStudentId' },
        { rowIndex: 2, sourceRecordId: 'SYN-000003', reason: 'invalid_field:recordVersion' },
      ],
    });
  });

  it('quarantines every row of a student that appears more than once', () => {
    const document = documentWithRows([
      buildRosterRow({ recordVersion: 1 }, 1),
      buildRosterRow({}, 2),
      buildRosterRow({ recordVersion: 2, isDeleted: true }, 1),
    ]);

    const result = parseSyntheticRoster(document, EXPECTED);

    expect(result).toMatchObject({
      isValid: true,
      rows: [buildRosterRow({}, 2)],
      quarantined: [
        { rowIndex: 0, sourceRecordId: 'SYN-000001', reason: 'duplicate_source_student_id' },
        { rowIndex: 2, sourceRecordId: 'SYN-000001', reason: 'duplicate_source_student_id' },
      ],
    });
  });

  it('quarantines a valid row whose student also appears in an invalid row', () => {
    const document = {
      batch: buildImportBatch({
        // NOTE: computed independently with `printf ... | sha256sum` over the two raw rows.
        checksum: '984dabb69639cbcb795f4c4000458751ed5378acade881d6c8551f79c92014b1',
        recordCount: 2,
      }),
      rows: [
        { sourceStudentId: 'SYN-000001', recordVersion: 5, isDeleted: false },
        { sourceStudentId: 'SYN-000001', recordVersion: 'x', isDeleted: true },
      ],
    };

    const result = parseSyntheticRoster(document, EXPECTED);

    expect(result).toMatchObject({
      isValid: true,
      rows: [],
      quarantined: [
        { rowIndex: 0, sourceRecordId: 'SYN-000001', reason: 'duplicate_source_student_id' },
        { rowIndex: 1, sourceRecordId: 'SYN-000001', reason: 'invalid_field:recordVersion' },
      ],
    });
  });

  it('checksums rows as received and never puts row values into a quarantine reason', () => {
    const document = {
      batch: buildImportBatch({
        // NOTE: computed independently with `printf ... | sha256sum` over the raw row.
        checksum: '427372bdd4358f4c48daffa52c51ffe23c709c6fa9515fbceba5abbaa214b079',
        recordCount: 1,
      }),
      rows: [{ sourceStudentId: 'SYN-000001', recordVersion: 1, isDeleted: 'yes' }],
    };

    const result = parseSyntheticRoster(document, EXPECTED);

    expect(result).toMatchObject({
      isValid: true,
      quarantined: [
        { rowIndex: 0, sourceRecordId: 'SYN-000001', reason: 'invalid_field:isDeleted' },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('yes');
  });
});
