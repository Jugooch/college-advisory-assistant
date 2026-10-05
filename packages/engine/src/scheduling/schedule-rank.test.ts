/**
 * @file Tests for the lexicographic ranking key: feasibility, preferences, then tie-break.
 */
import { describe, expect, it } from 'vitest';

import { compareNumberLists, comparePreferenceParts, compareRankKeys } from './schedule-rank';

describe('compareNumberLists', () => {
  it('lets the first difference decide', () => {
    expect(compareNumberLists([1, 5], [2, 0])).toBeLessThan(0);
    expect(compareNumberLists([2, 0], [1, 5])).toBeGreaterThan(0);
  });

  it('puts a proper prefix first, in either argument order', () => {
    expect(compareNumberLists([1], [1, 2])).toBeLessThan(0);
    expect(compareNumberLists([1, 2], [1])).toBeGreaterThan(0);
  });

  it('is zero for equal lists', () => {
    expect(compareNumberLists([1, 2], [1, 2])).toBe(0);
  });
});

describe('compareRankKeys', () => {
  const pass = { isUnknown: false, misses: [1, 1], ordinals: [9] };

  it('ranks a PASS schedule above an UNKNOWN one whatever their preferences', () => {
    const unknown = { isUnknown: true, misses: [0, 0], ordinals: [0] };

    expect(compareRankKeys(pass, unknown)).toBeLessThan(0);
    expect(compareRankKeys(unknown, pass)).toBeGreaterThan(0);
  });

  it('ranks by preferences in priority order before the tie-break', () => {
    const missesSecond = { isUnknown: false, misses: [0, 1], ordinals: [9] };

    expect(comparePreferenceParts(missesSecond, pass)).toBeLessThan(0);
    expect(compareRankKeys({ ...pass, misses: [1, 0] }, missesSecond)).toBeGreaterThan(0);
  });

  it('breaks a tie by the sorted section ordinals', () => {
    expect(compareRankKeys({ ...pass, ordinals: [3] }, pass)).toBeLessThan(0);
  });
});
