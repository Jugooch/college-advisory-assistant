/**
 * @file Tests for the meeting pattern data object.
 */
import { describe, expect, it } from 'vitest';

import {
  createMeetingPattern,
  type MeetingPatternInput,
  MeetingPatternSchema,
} from './meeting-pattern.model';

const NORTH_CAMPUS_ID = 'c4a1b2c3-0000-4000-8000-000000000001';

const LECTURE: MeetingPatternInput = {
  weekdays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
  startTime: '09:00',
  endTime: '09:50',
  startsOn: '2026-08-24',
  endsOn: '2026-12-11',
  excludedDates: ['2026-09-07'],
  location: { kind: 'ON_CAMPUS', campusId: NORTH_CAMPUS_ID, room: 'SCI 204' },
};

describe('createMeetingPattern', () => {
  it('accepts a timed, dated, on-campus meeting with a holiday', () => {
    expect(createMeetingPattern(LECTURE)).toEqual({
      weekdays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      startTime: '09:00',
      endTime: '09:50',
      startsOn: '2026-08-24',
      endsOn: '2026-12-11',
      excludedDates: ['2026-09-07'],
      location: { kind: 'ON_CAMPUS', campusId: NORTH_CAMPUS_ID, room: 'SCI 204' },
    });
  });

  it('accepts a meeting whose days, times, and location are all to be announced', () => {
    const meeting = createMeetingPattern({
      ...LECTURE,
      weekdays: null,
      startTime: null,
      endTime: null,
      location: null,
    });

    expect([meeting.weekdays, meeting.startTime, meeting.endTime, meeting.location]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('accepts an online meeting and an on-campus meeting with no room assigned', () => {
    expect(createMeetingPattern({ ...LECTURE, location: { kind: 'ONLINE' } }).location).toEqual({
      kind: 'ONLINE',
    });
    expect(
      createMeetingPattern({
        ...LECTURE,
        location: { kind: 'ON_CAMPUS', campusId: NORTH_CAMPUS_ID, room: null },
      }).location,
    ).toEqual({ kind: 'ON_CAMPUS', campusId: NORTH_CAMPUS_ID, room: null });
  });

  it('accepts a one-day meeting and midnight-bounded times', () => {
    const meeting = createMeetingPattern({
      ...LECTURE,
      startTime: '00:00',
      endTime: '23:59',
      endsOn: '2026-08-24',
      excludedDates: [],
    });

    expect([meeting.startTime, meeting.endTime, meeting.endsOn]).toEqual([
      '00:00',
      '23:59',
      '2026-08-24',
    ]);
  });

  it('rejects an end time before the start time', () => {
    expect(() => createMeetingPattern({ ...LECTURE, endTime: '08:59' })).toThrow(
      /startTime must be earlier than endTime/,
    );
  });

  it('rejects a zero-length meeting', () => {
    expect(() => createMeetingPattern({ ...LECTURE, endTime: '09:00' })).toThrow(
      /startTime must be earlier than endTime/,
    );
  });

  it.each([
    { startTime: null, endTime: '09:50' },
    { startTime: '09:00', endTime: null },
  ])('rejects a half-known time %j', (times) => {
    expect(() => createMeetingPattern({ ...LECTURE, ...times })).toThrow(
      /must both be set or both be null/,
    );
  });

  it.each(['9:00', '09:00:00', '24:00', '09:60', ''])('rejects the time %j', (startTime) => {
    expect(() => createMeetingPattern({ ...LECTURE, startTime })).toThrow();
  });

  it('rejects an end date before the start date', () => {
    expect(() => createMeetingPattern({ ...LECTURE, endsOn: '2026-08-23' })).toThrow(
      /startsOn must not be later than endsOn/,
    );
  });

  it('rejects a date with a time of day', () => {
    expect(() => createMeetingPattern({ ...LECTURE, startsOn: '2026-08-24T00:00:00Z' })).toThrow();
  });

  it('rejects an empty or repeated weekday list', () => {
    expect(() => createMeetingPattern({ ...LECTURE, weekdays: [] })).toThrow();
    expect(() => createMeetingPattern({ ...LECTURE, weekdays: ['MONDAY', 'MONDAY'] })).toThrow(
      /weekdays must not repeat a day/,
    );
  });

  it.each([
    { excludedDates: ['2026-08-23'] },
    { excludedDates: ['2026-12-12'] },
    { excludedDates: ['2026-09-07', '2026-09-07'] },
  ])('rejects the excluded dates %j', ({ excludedDates }) => {
    expect(() => createMeetingPattern({ ...LECTURE, excludedDates })).toThrow(
      /excludedDates must be distinct dates between startsOn and endsOn/,
    );
  });
});

describe('MeetingPatternSchema', () => {
  it('rejects an unknown weekday', () => {
    expect(MeetingPatternSchema.safeParse({ ...LECTURE, weekdays: ['MON'] }).success).toBe(false);
  });

  it('rejects an on-campus location without a campus', () => {
    const location = { kind: 'ON_CAMPUS', room: 'SCI 204' };

    expect(MeetingPatternSchema.safeParse({ ...LECTURE, location }).success).toBe(false);
  });

  it('reports a reversed time on the endTime field', () => {
    const result = MeetingPatternSchema.safeParse({ ...LECTURE, startTime: '10:00' });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['endTime']]);
  });
});
