/**
 * @file Tests for the bounded search: top-three ranking, credit totals and credit conflicts.
 */
import { describe, expect, it } from 'vitest';

import { buildAcademicPolicy } from '@caa/test-kit';

import { boundsOf } from './candidate-credits';
import { type SearchBundle, searchSchedules, type SearchSpace } from './search-schedules';

const COMPATIBLE_TABLE = { verdictOf: () => ({ fail: null, unknownIssues: [] }) };

/**
 * Builds a one-course, one-section bundle worth 3 credits.
 *
 * @param index - Its position, also its course position.
 * @param fields - Its misses and section ordinal.
 * @returns The bundle.
 */
function bundle(
  index: number,
  fields: { readonly miss: number; readonly ordinal: number },
): SearchBundle {
  return {
    index,
    isUnknown: false,
    misses: [fields.miss],
    ordinals: [fields.ordinal],
    courses: [{ index: 0, credits: 300, includer: -1 }],
  };
}

/**
 * Builds a space with one course and the given bundles.
 *
 * @param bundles - The course's bundles, in search order.
 * @param maxCreditsHundredths - The policy's maximum load.
 * @returns The space.
 */
function oneCourse(bundles: readonly SearchBundle[], maxCreditsHundredths = 3000): SearchSpace {
  return {
    courses: [bundles],
    courseCount: 1,
    slotCount: 1,
    table: COMPATIBLE_TABLE,
    credits: boundsOf(
      buildAcademicPolicy({ termCreditBounds: { minCreditsHundredths: 0, maxCreditsHundredths } }),
      [],
    ),
    creditSlot: null,
  };
}

describe('searchSchedules top three', () => {
  it('keeps the best three by preferences, then tie-break, whatever the search order', () => {
    const bundles = [
      bundle(0, { miss: 0, ordinal: 5 }),
      bundle(1, { miss: 0, ordinal: 4 }),
      bundle(2, { miss: 0, ordinal: 3 }),
      bundle(3, { miss: 1, ordinal: 0 }),
      bundle(4, { miss: 0, ordinal: 1 }),
      bundle(5, { miss: 0, ordinal: 6 }),
    ];

    const result = searchSchedules(oneCourse(bundles), 100);

    expect(result.top.map((candidate) => candidate.chosen)).toEqual([[4], [2], [1]]);
    expect(result).toMatchObject({ capHit: false, workUsed: 6, creditConflictCount: 0 });
  });

  it('appends a lower-ranked candidate while fewer than three are kept', () => {
    const result = searchSchedules(
      oneCourse([bundle(0, { miss: 0, ordinal: 0 }), bundle(1, { miss: 1, ordinal: 1 })]),
      100,
    );

    expect(result.top.map((candidate) => candidate.chosen)).toEqual([[0], [1]]);
  });
});

describe('searchSchedules credits', () => {
  it('counts a course included in a chosen course once', () => {
    const lecture: SearchBundle = {
      index: 0,
      isUnknown: false,
      misses: [],
      ordinals: [0, 1],
      courses: [
        { index: 0, credits: 300, includer: -1 },
        { index: 1, credits: 100, includer: 0 },
      ],
    };
    // Counted on its own, the lab would make 4 credits, above the 3-credit maximum.
    const space: SearchSpace = { ...oneCourse([lecture], 300), slotCount: 0, courseCount: 2 };

    expect(searchSchedules(space, 10).top).toHaveLength(1);
  });

  it('keeps the first 20 credit conflicts in tie-break order and counts them all', () => {
    const bundles = Array.from({ length: 22 }, (_, index) =>
      bundle(index, { miss: 0, ordinal: 21 - index }),
    );

    const result = searchSchedules(oneCourse(bundles, 200), 100);

    expect(result.top).toEqual([]);
    expect(result.creditConflictCount).toBe(22);
    expect(result.creditConflicts.map((conflict) => conflict.ordinals[0])).toEqual(
      Array.from({ length: 20 }, (_, position) => position),
    );
    expect(result.creditConflicts[0]?.reasonCode).toBe('CREDIT_LIMIT_EXCEEDED');
  });

  it('appends a later credit conflict that sorts last', () => {
    const result = searchSchedules(
      oneCourse([bundle(0, { miss: 0, ordinal: 0 }), bundle(1, { miss: 0, ordinal: 1 })], 200),
      100,
    );

    expect(result.creditConflicts.map((conflict) => conflict.chosen)).toEqual([[0], [1]]);
  });
});
