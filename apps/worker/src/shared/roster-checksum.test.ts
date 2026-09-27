/**
 * @file Tests for the worker's canonical roster checksum. The test-kit builders compute the
 * reference checksum independently; literal digests were computed with `printf ... | sha256sum`.
 */
import { describe, expect, it } from 'vitest';

import { buildRosterBatch, buildRosterRow } from '@caa/test-kit';

import { computeRosterChecksum } from './roster-checksum';

describe('computeRosterChecksum', () => {
  it('matches the test-kit checksum of the default synthetic batch', () => {
    const { batch, rows } = buildRosterBatch();

    expect(computeRosterChecksum(rows)).toBe(batch.checksum);
  });

  it('matches the test-kit checksum for tombstones, null versions, and non-ASCII IDs', () => {
    const { batch, rows } = buildRosterBatch({
      rows: [
        buildRosterRow({ recordVersion: null }, 4),
        buildRosterRow({ isDeleted: true, recordVersion: 3 }, 5),
        buildRosterRow({ sourceStudentId: 'SYN-É01', recordVersion: 7 }),
      ],
    });

    expect(computeRosterChecksum(rows)).toBe(batch.checksum);
  });

  it('matches the test-kit checksum of an empty batch', () => {
    const { batch } = buildRosterBatch({ rows: [] });

    expect(computeRosterChecksum([])).toBe(batch.checksum);
  });

  it('matches the literal reference digest for two rows', () => {
    const rows = [
      buildRosterRow({ recordVersion: 1 }, 1),
      buildRosterRow({ recordVersion: null, isDeleted: true }, 2),
    ];

    expect(computeRosterChecksum(rows)).toBe(
      '6342c62a60b40b247a04af936f4e3a380e5465400adaf7897934c3a5e0302a3e',
    );
  });

  it('gives the SHA-256 of the empty string for zero rows', () => {
    expect(computeRosterChecksum([])).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('ignores extra keys and key order on a row', () => {
    const row = buildRosterRow({}, 1);
    const reordered = {
      extra: 'ignored',
      isDeleted: false,
      recordVersion: 1,
      sourceStudentId: row.sourceStudentId,
    };

    expect(computeRosterChecksum([reordered])).toBe(computeRosterChecksum([row]));
  });

  it('serializes a non-object row as an empty object', () => {
    expect(computeRosterChecksum([null])).toBe(
      '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
    );
  });

  it('changes when the row order changes', () => {
    const { batch, rows } = buildRosterBatch();

    expect(computeRosterChecksum([...rows].reverse())).not.toBe(batch.checksum);
  });
});
