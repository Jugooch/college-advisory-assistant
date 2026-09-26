/**
 * @file Tests for the roster row data object.
 */
import { describe, expect, it } from 'vitest';

import { createRosterRow, type RosterRowInput, RosterRowSchema } from './roster-row.model';

const VALID: RosterRowInput = {
  sourceStudentId: 'DEMO-S-0001',
  recordVersion: 7,
  isDeleted: false,
};

describe('createRosterRow', () => {
  it('accepts a valid upsert row', () => {
    expect(createRosterRow(VALID)).toEqual({
      sourceStudentId: 'DEMO-S-0001',
      recordVersion: 7,
      isDeleted: false,
    });
  });

  it('accepts a tombstone row', () => {
    expect(createRosterRow({ ...VALID, isDeleted: true }).isDeleted).toBe(true);
  });

  it('accepts a null recordVersion when the source supplies none', () => {
    expect(createRosterRow({ ...VALID, recordVersion: null }).recordVersion).toBeNull();
  });

  it('rejects an empty sourceStudentId', () => {
    expect(() => createRosterRow({ ...VALID, sourceStudentId: '' })).toThrow();
  });

  it('rejects a fractional recordVersion', () => {
    expect(() => createRosterRow({ ...VALID, recordVersion: 1.5 })).toThrow();
  });
});

describe('RosterRowSchema', () => {
  it('rejects a row with no isDeleted flag, so absence is never read as a deletion', () => {
    const result = RosterRowSchema.safeParse({ sourceStudentId: 'DEMO-S-0001', recordVersion: 7 });

    expect(result.success).toBe(false);
  });

  it('rejects an omitted recordVersion, because unknown must be an explicit null', () => {
    const result = RosterRowSchema.safeParse({ sourceStudentId: 'DEMO-S-0001', isDeleted: false });

    expect(result.success).toBe(false);
  });
});
