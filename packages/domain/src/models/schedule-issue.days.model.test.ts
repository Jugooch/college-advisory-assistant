/**
 * @file Tests that schedule issues prove a FAIL only with known meeting days, and show only
 *   days the named meetings meet on.
 */
import { describe, expect, it } from 'vitest';

import { ScheduleIssueSchema } from './schedule-issue.model';

const LECTURE = '5ec71010-0000-4000-8000-000000000001';
const LAB = '5ec71010-0000-4000-8000-000000000011';
const NORTH = 'c4a1b2c3-0000-4000-8000-000000000001';
const SOUTH = 'c4a1b2c3-0000-4000-8000-000000000002';

const KNOWN_DAYS = 'A FAIL issue names meetings whose days are known';
const DAYS_SUBSET = 'The weekdays shown must be days each named meeting meets on';

const meeting = (
  sectionId: string,
  weekdays: readonly string[] | null,
  [startTime, endTime]: readonly [string, string],
): object => ({ sectionId, meetingIndex: 0, weekdays, startTime, endTime });

const onMonday = (days: readonly string[] = ['MONDAY']): object => ({
  firstDate: '2026-08-24',
  lastDate: '2026-12-07',
  weekdays: days,
});

const messages = (issue: unknown): readonly string[] =>
  ScheduleIssueSchema.safeParse(issue).error?.issues.map((issue) => issue.message) ?? [];

const conflict = (firstDays: readonly string[] | null, shared = onMonday()): object => ({
  reasonCode: 'MEETING_CONFLICT',
  first: meeting(LECTURE, firstDays, ['09:00', '10:00']),
  second: meeting(LAB, ['MONDAY'], ['09:30', '10:30']),
  sharedDates: shared,
});

const insufficient = (earlierDays: readonly string[] | null, shared = onMonday()): object => ({
  reasonCode: 'TRANSITION_TIME_INSUFFICIENT',
  earlier: meeting(LECTURE, earlierDays, ['09:00', '09:50']),
  later: meeting(LAB, ['MONDAY'], ['10:00', '10:50']),
  sharedDates: shared,
  fromCampusId: NORTH,
  toCampusId: SOUTH,
  requiredMinutes: 15,
  availableMinutes: 10,
});

const blocked = (meetingDays: readonly string[] | null, days = ['MONDAY']): object => ({
  reasonCode: 'UNAVAILABLE_TIME_CONFLICT',
  meeting: meeting(LECTURE, meetingDays, ['09:00', '09:50']),
  constraintIndex: 0,
  weekdays: days,
  blockStartTime: '00:00',
  blockEndTime: '10:00',
});

describe('FAIL schedule issues need known meeting days (GR-02)', () => {
  it('accepts each FAIL shape when every named meeting has known days', () => {
    expect(messages(conflict(['MONDAY', 'WEDNESDAY']))).toEqual([]);
    expect(messages(insufficient(['MONDAY']))).toEqual([]);
    expect(messages(blocked(['MONDAY']))).toEqual([]);
  });

  it('rejects MEETING_CONFLICT with a meeting whose days are TBA', () => {
    expect(messages(conflict(null))).toEqual([KNOWN_DAYS]);
  });

  it('rejects TRANSITION_TIME_INSUFFICIENT with a meeting whose days are TBA', () => {
    expect(messages(insufficient(null))).toEqual([KNOWN_DAYS]);
  });

  it('rejects UNAVAILABLE_TIME_CONFLICT with a meeting whose days are TBA', () => {
    expect(messages(blocked(null))).toEqual([KNOWN_DAYS]);
  });

  it('accepts TRANSITION_TIME_UNDEFINED with TBA days, because it is UNKNOWN anyway', () => {
    const undefinedPair = {
      ...insufficient(null),
      reasonCode: 'TRANSITION_TIME_UNDEFINED',
      requiredMinutes: null,
    };

    expect(messages(undefinedPair)).toEqual([]);
  });
});

describe('schedule issues show only days the named meetings meet on', () => {
  it('rejects shared days a conflicting meeting does not meet on', () => {
    expect(messages(conflict(['MONDAY'], onMonday(['MONDAY', 'SUNDAY'])))).toEqual([DAYS_SUBSET]);
  });

  it('rejects shared days a transition meeting does not meet on, for both transition codes', () => {
    const sunday = insufficient(['MONDAY'], onMonday(['SUNDAY']));

    expect(messages(sunday)).toEqual([DAYS_SUBSET]);
    expect(
      messages({ ...sunday, reasonCode: 'TRANSITION_TIME_UNDEFINED', requiredMinutes: null }),
    ).toEqual([DAYS_SUBSET]);
  });

  it('rejects blocked days the meeting does not meet on', () => {
    expect(messages(blocked(['MONDAY'], ['SUNDAY']))).toEqual([DAYS_SUBSET]);
  });

  it('rejects shared days a meeting does not meet on for an unknown location pair', () => {
    const location = {
      reasonCode: 'MEETING_LOCATION_UNKNOWN',
      meeting: meeting(LAB, ['MONDAY'], ['10:00', '11:00']),
      otherMeeting: meeting(LECTURE, ['MONDAY'], ['09:00', '09:50']),
      sharedDates: onMonday(['FRIDAY']),
      constraintIndex: null,
    };

    expect(messages(location)).toEqual([DAYS_SUBSET]);
  });

  it('accepts any shared days beside a meeting whose days are TBA, which could be any day', () => {
    const tbaTime = {
      reasonCode: 'MEETING_TIME_UNKNOWN',
      meeting: meeting(LAB, null, ['10:00', '11:00']),
      otherMeeting: meeting(LECTURE, ['MONDAY', 'FRIDAY'], ['09:00', '09:50']),
      sharedDates: onMonday(['MONDAY', 'FRIDAY']),
      constraintIndex: null,
    };

    expect(messages(tbaTime)).toEqual([]);
  });
});

describe('private schedule-issue helpers, through the public schema', () => {
  const TRANSITION_MESSAGE =
    'An insufficient transition has availableMinutes below requiredMinutes';

  it('measures a transition gap across hours in wall-clock minutes (11:50 to 13:05 is 75)', () => {
    const acrossHours = {
      ...insufficient(['MONDAY']),
      earlier: meeting(LECTURE, ['MONDAY'], ['11:00', '11:50']),
      later: meeting(LAB, ['MONDAY'], ['13:05', '14:00']),
      requiredMinutes: 90,
    };

    expect(messages({ ...acrossHours, availableMinutes: 75 })).toEqual([]);
    expect(messages({ ...acrossHours, availableMinutes: 15 })).toEqual([TRANSITION_MESSAGE]);
  });

  it('rejects a transition that names one meeting twice', () => {
    const itself = {
      ...insufficient(['MONDAY']),
      later: meeting(LECTURE, ['MONDAY'], ['10:00', '10:50']),
    };

    expect(messages(itself)).toEqual([TRANSITION_MESSAGE]);
  });

  it('accepts an unavailable block that runs to 24:00, and rejects one that ends at its start', () => {
    expect(messages({ ...blocked(['MONDAY']), blockEndTime: '24:00' })).toEqual([]);
    expect(messages({ ...blocked(['MONDAY']), blockStartTime: '10:00' })).toEqual([
      'blockStartTime must be earlier than blockEndTime',
      'An unavailable-time conflict names a timed meeting that overlaps the block',
    ]);
  });
});
