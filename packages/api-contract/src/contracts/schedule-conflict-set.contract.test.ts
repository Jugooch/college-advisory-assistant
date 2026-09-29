/**
 * @file Tests for the conflict set behind a NO_FEASIBLE_PLAN outcome.
 */
import { describe, expect, it } from 'vitest';

import {
  CREDIT_CONFLICT,
  creditLoadCheck,
  PASS_SCHEDULE,
} from '../testing/schedule-option-fixtures';
import { ConflictSetSchema, MAX_CONFLICT_SET_ITEMS } from './schedule-conflict-set.contract';

const messages = (payload: unknown): readonly string[] =>
  ConflictSetSchema.safeParse(payload).error?.issues.map((issue) => issue.message) ?? [];

/** Twenty distinct over-limit loads, 20.01 to 20.20 credits. */
const FULL = Array.from({ length: MAX_CONFLICT_SET_ITEMS }, (_, index) =>
  creditLoadCheck(2001 + index, 'FAIL'),
);

describe('ConflictSetSchema', () => {
  it('accepts one verified conflict, never claimed minimal', () => {
    const conflicts = { items: [CREDIT_CONFLICT], isMinimal: false, omittedCount: 0 };

    expect(ConflictSetSchema.parse(conflicts)).toEqual(conflicts);
  });

  it('rejects a conflict that is not a FAIL, an empty list, and a set claimed minimal', () => {
    expect(
      ConflictSetSchema.safeParse({ items: [PASS_SCHEDULE], isMinimal: false, omittedCount: 0 })
        .success,
    ).toBe(false);
    expect(
      ConflictSetSchema.safeParse({ items: [], isMinimal: false, omittedCount: 0 }).success,
    ).toBe(false);
    expect(
      ConflictSetSchema.safeParse({ items: [CREDIT_CONFLICT], isMinimal: true, omittedCount: 0 })
        .success,
    ).toBe(false);
  });

  it('rejects a repeated conflict', () => {
    expect(
      messages({ items: [CREDIT_CONFLICT, CREDIT_CONFLICT], isMinimal: false, omittedCount: 0 }),
    ).toEqual(['conflictSet items must be distinct']);
  });

  it('counts omitted conflicts only once the list is full', () => {
    expect(
      ConflictSetSchema.safeParse({ items: FULL, isMinimal: false, omittedCount: 5 }).success,
    ).toBe(true);
    expect(messages({ items: [CREDIT_CONFLICT], isMinimal: false, omittedCount: 5 })).toEqual([
      'omittedCount must be 0 unless items is full',
    ]);
  });

  it('rejects more than the cap', () => {
    const tooMany = [...FULL, creditLoadCheck(2100, 'FAIL')];

    expect(
      ConflictSetSchema.safeParse({ items: tooMany, isMinimal: false, omittedCount: 0 }).success,
    ).toBe(false);
  });
});
