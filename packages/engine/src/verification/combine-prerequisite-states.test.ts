/**
 * @file Tests for the three-valued ALL and ANY truth tables.
 */
import { describe, expect, it } from 'vitest';

import { CheckState } from '@caa/domain';

import { combineAllStates, combineAnyStates } from './combine-prerequisite-states';

const { Pass, Conditional, Unknown, Fail } = CheckState;

describe('combineAllStates', () => {
  it.each([
    [Pass, Pass, 'PASS'],
    [Pass, Conditional, 'CONDITIONAL'],
    [Pass, Unknown, 'UNKNOWN'],
    [Pass, Fail, 'FAIL'],
    [Conditional, Pass, 'CONDITIONAL'],
    [Conditional, Conditional, 'CONDITIONAL'],
    [Conditional, Unknown, 'UNKNOWN'],
    [Conditional, Fail, 'FAIL'],
    [Unknown, Pass, 'UNKNOWN'],
    [Unknown, Conditional, 'UNKNOWN'],
    [Unknown, Unknown, 'UNKNOWN'],
    [Unknown, Fail, 'FAIL'],
    [Fail, Pass, 'FAIL'],
    [Fail, Conditional, 'FAIL'],
    [Fail, Unknown, 'FAIL'],
    [Fail, Fail, 'FAIL'],
  ])('combines %s and %s into %s', (left, right, expected) => {
    expect(combineAllStates([left, right])).toBe(expected);
  });

  it('returns the only child state unchanged', () => {
    expect(combineAllStates([Conditional])).toBe('CONDITIONAL');
  });

  it('returns UNKNOWN, not a vacuous PASS, for an empty group', () => {
    expect(combineAllStates([])).toBe('UNKNOWN');
  });
});

describe('combineAnyStates', () => {
  it.each([
    [Pass, Pass, 'PASS'],
    [Pass, Conditional, 'PASS'],
    [Pass, Unknown, 'PASS'],
    [Pass, Fail, 'PASS'],
    [Conditional, Pass, 'PASS'],
    [Conditional, Conditional, 'CONDITIONAL'],
    [Conditional, Unknown, 'CONDITIONAL'],
    [Conditional, Fail, 'CONDITIONAL'],
    [Unknown, Pass, 'PASS'],
    [Unknown, Conditional, 'CONDITIONAL'],
    [Unknown, Unknown, 'UNKNOWN'],
    [Unknown, Fail, 'UNKNOWN'],
    [Fail, Pass, 'PASS'],
    [Fail, Conditional, 'CONDITIONAL'],
    [Fail, Unknown, 'UNKNOWN'],
    [Fail, Fail, 'FAIL'],
  ])('combines %s and %s into %s', (left, right, expected) => {
    expect(combineAnyStates([left, right])).toBe(expected);
  });

  it('returns the only child state unchanged', () => {
    expect(combineAnyStates([Fail])).toBe('FAIL');
  });

  it('returns UNKNOWN, not a vacuous FAIL, for an empty group', () => {
    expect(combineAnyStates([])).toBe('UNKNOWN');
  });
});
