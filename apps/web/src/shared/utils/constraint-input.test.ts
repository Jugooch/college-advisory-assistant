/**
 * @file Tests for reading typed constraint input.
 */
import { describe, expect, it } from 'vitest';

import {
  readCreditBound,
  readPriorityRank,
  readTimeBounds,
  splitCampusIds,
} from './constraint-input';

describe('readTimeBounds', () => {
  it('fills a blank start and end with the whole day', () => {
    expect(readTimeBounds('', '')).toEqual({ startTime: '00:00', endTime: '24:00' });
  });

  it('keeps typed times', () => {
    expect(readTimeBounds('09:30', '')).toEqual({ startTime: '09:30', endTime: '24:00' });
  });
});

describe('splitCampusIds', () => {
  it('splits on commas and spaces and drops empties', () => {
    expect(splitCampusIds(' north, south  east,')).toEqual(['north', 'south', 'east']);
    expect(splitCampusIds('  ')).toEqual([]);
  });
});

describe('readPriorityRank', () => {
  it('accepts one or two digits from 1', () => {
    expect(readPriorityRank('1')).toBe(1);
    expect(readPriorityRank('99')).toBe(99);
  });

  it('refuses zero, blanks, signs, decimals and three digits', () => {
    for (const text of ['0', '', '-1', '1.5', '100', 'a']) {
      expect(readPriorityRank(text)).toBeNull();
    }
  });
});

describe('readCreditBound', () => {
  it('reads blank as no bound, a number as hundredths, and anything else as undefined', () => {
    expect(readCreditBound('  ')).toBeNull();
    expect(readCreditBound('12')).toBe(1200);
    expect(readCreditBound('12.5')).toBe(1250);
    expect(readCreditBound('lots')).toBeUndefined();
  });
});
