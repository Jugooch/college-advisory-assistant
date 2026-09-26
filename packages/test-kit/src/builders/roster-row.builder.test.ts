/**
 * @file Tests for the synthetic roster row builder.
 */
import { describe, expect, it } from 'vitest';

import { RosterRowSchema } from '@caa/domain';

import { buildRosterRow } from './roster-row.builder';

describe('buildRosterRow', () => {
  it('defaults to a non-deleted row at version 1', () => {
    expect(buildRosterRow()).toEqual({
      sourceStudentId: 'SYN-000001',
      recordVersion: 1,
      isDeleted: false,
    });
  });

  it('returns deep-equal rows for the same arguments', () => {
    expect(buildRosterRow({ isDeleted: true }, 3)).toEqual(buildRosterRow({ isDeleted: true }, 3));
  });

  it('derives the sourceStudentId from the seed', () => {
    expect(buildRosterRow({}, 3).sourceStudentId).toBe('SYN-000003');
  });

  it('applies overrides', () => {
    const row = buildRosterRow({ recordVersion: null, isDeleted: true });

    expect(row.recordVersion).toBeNull();
    expect(row.isDeleted).toBe(true);
  });

  it('returns a row that passes the domain schema', () => {
    expect(RosterRowSchema.safeParse(buildRosterRow()).success).toBe(true);
  });

  it('rejects overrides the domain forbids', () => {
    expect(() => buildRosterRow({ recordVersion: 1.5 })).toThrow();
  });
});
