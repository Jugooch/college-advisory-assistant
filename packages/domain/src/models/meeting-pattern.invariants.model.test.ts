/**
 * @file Tests for the shared scheduling invariants: time-range overlap and transition time.
 */
import { describe, expect, it } from 'vitest';

import { hasEnoughTransitionTime } from './campus-transition-policy.model';
import { doLocalTimeRangesOverlap } from './meeting-pattern.model';

const range = (startTime: string, endTime: string): { startTime: string; endTime: string } => ({
  startTime,
  endTime,
});

describe('doLocalTimeRangesOverlap', () => {
  it.each([
    [range('09:00', '09:50'), range('09:30', '10:20'), true],
    [range('09:00', '12:00'), range('10:00', '11:00'), true],
    [range('09:00', '09:50'), range('09:00', '09:50'), true],
    [range('09:00', '09:50'), range('09:50', '10:40'), false],
    [range('09:50', '10:40'), range('09:00', '09:50'), false],
    [range('09:00', '09:50'), range('13:00', '13:50'), false],
    [range('23:00', '23:59'), range('00:00', '24:00'), true],
    [range('09:00', '09:50'), range('00:00', '09:00'), false],
  ])('%j and %j overlap: %j', (first, second, expected) => {
    expect(doLocalTimeRangesOverlap(first, second)).toBe(expected);
  });

  it('never throws, even on malformed input', () => {
    expect(doLocalTimeRangesOverlap(range('', 'x'), range('09:00', '09:50'))).toBe(false);
  });
});

describe('hasEnoughTransitionTime', () => {
  it.each([
    [10, 15, false],
    [14, 15, false],
    [15, 15, true],
    [40, 15, true],
    [0, 0, true],
  ])('a %i-minute gap for a %i-minute transition is enough: %j', (gap, minutes, expected) => {
    expect(hasEnoughTransitionTime(gap, { minutes })).toBe(expected);
  });
});
