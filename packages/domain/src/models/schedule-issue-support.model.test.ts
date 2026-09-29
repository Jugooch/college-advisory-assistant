/**
 * @file Tests for the private schedule-issue support: minute arithmetic and meeting helpers.
 */
import { describe, expect, it } from 'vitest';

import { isSameMeeting, localTimeGapMinutes, meetsOnDays } from './schedule-issue-support.model';

describe('localTimeGapMinutes', () => {
  it.each([
    ['09:50', '10:00', 10],
    ['09:50', '09:50', 0],
    ['11:50', '13:05', 75],
    ['10:00', '09:50', -10],
    ['00:00', '24:00', 1440],
  ])('from %s to %s is %i minutes', (from, to, expected) => {
    expect(localTimeGapMinutes(from, to)).toBe(expected);
  });
});

describe('isSameMeeting', () => {
  const lecture = { sectionId: 'a', meetingIndex: 0 };

  it('matches only the same section and meeting index', () => {
    expect(isSameMeeting(lecture, { sectionId: 'a', meetingIndex: 0 })).toBe(true);
    expect(isSameMeeting(lecture, { sectionId: 'a', meetingIndex: 1 })).toBe(false);
    expect(isSameMeeting(lecture, { sectionId: 'b', meetingIndex: 0 })).toBe(false);
  });
});

describe('meetsOnDays', () => {
  it('accepts only days the meeting meets on', () => {
    expect(meetsOnDays({ weekdays: ['MONDAY', 'FRIDAY'] }, ['FRIDAY'])).toBe(true);
    expect(meetsOnDays({ weekdays: ['MONDAY'] }, ['MONDAY', 'SUNDAY'])).toBe(false);
  });

  it('accepts any days for a meeting whose days are to be announced (GR-02)', () => {
    expect(meetsOnDays({ weekdays: null }, ['SUNDAY'])).toBe(true);
  });
});
