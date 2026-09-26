/**
 * @file Tests for the canonical roster serialization and checksum. Expected digests were computed
 * independently with `printf ... | sha256sum`, not with this code.
 */
import { describe, expect, it } from 'vitest';

import { computeRosterChecksum, serializeRosterRows } from './roster-checksum';

const TWO_ROWS = [
  { sourceStudentId: 'SYN-000001', recordVersion: 1, isDeleted: false },
  { sourceStudentId: 'SYN-000002', recordVersion: null, isDeleted: true },
];

describe('serializeRosterRows', () => {
  it('writes one JSON object per row in fixed key order, joined by a newline', () => {
    expect(serializeRosterRows(TWO_ROWS)).toBe(
      '{"sourceStudentId":"SYN-000001","recordVersion":1,"isDeleted":false}\n' +
        '{"sourceStudentId":"SYN-000002","recordVersion":null,"isDeleted":true}',
    );
  });

  it('ignores the key order of the input rows', () => {
    const reordered = [{ isDeleted: false, recordVersion: 1, sourceStudentId: 'SYN-000001' }];

    expect(serializeRosterRows(reordered)).toBe(
      '{"sourceStudentId":"SYN-000001","recordVersion":1,"isDeleted":false}',
    );
  });

  it('serializes zero rows as the empty string', () => {
    expect(serializeRosterRows([])).toBe('');
  });
});

describe('computeRosterChecksum', () => {
  it('matches the independently computed SHA-256 for two rows', () => {
    expect(computeRosterChecksum(TWO_ROWS)).toBe(
      '6342c62a60b40b247a04af936f4e3a380e5465400adaf7897934c3a5e0302a3e',
    );
  });

  it('hashes non-ASCII identifiers as UTF-8', () => {
    const rows = [{ sourceStudentId: 'SYN-É01', recordVersion: 7, isDeleted: false }];

    expect(computeRosterChecksum(rows)).toBe(
      'aca4d28016f6acb4aa61279b2158378747e12dae8d1f4e718a5545cfd019b513',
    );
  });

  it('gives the SHA-256 of the empty string for zero rows', () => {
    expect(computeRosterChecksum([])).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('changes when the row order changes', () => {
    const reversed = [...TWO_ROWS].reverse();

    expect(computeRosterChecksum(reversed)).not.toBe(
      '6342c62a60b40b247a04af936f4e3a380e5465400adaf7897934c3a5e0302a3e',
    );
  });
});
