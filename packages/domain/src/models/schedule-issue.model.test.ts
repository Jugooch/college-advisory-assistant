/**
 * @file Tests for schedule issues: each schedule reason code and the evidence it requires.
 */
import { describe, expect, it } from 'vitest';

import {
  createScheduleIssue,
  SCHEDULE_REASON_STATE,
  type ScheduleIssueInput,
  ScheduleIssueSchema,
} from './schedule-issue.model';

const LECTURE = '5ec71010-0000-4000-8000-000000000001';
const LAB = '5ec71010-0000-4000-8000-000000000011';
const NORTH = 'c4a1b2c3-0000-4000-8000-000000000001';
const SOUTH = 'c4a1b2c3-0000-4000-8000-000000000002';
const PHYS_301L = 'c0a5e000-0000-4000-8000-000000003010';

const MWF = { firstDate: '2026-08-24', lastDate: '2026-12-11', weekdays: ['MONDAY', 'FRIDAY'] };
/** Meeting days; `null` when the days are to be announced. */
type Days = readonly string[] | null;
const MON_FRI: Days = ['MONDAY', 'FRIDAY'];
const lecture = (
  startTime: string | null,
  endTime: string | null,
  weekdays: Days = MON_FRI,
): object => ({
  sectionId: LECTURE,
  meetingIndex: 0,
  weekdays,
  startTime,
  endTime,
});
const lab = (
  startTime: string | null,
  endTime: string | null,
  weekdays: Days = MON_FRI,
): object => ({
  sectionId: LAB,
  meetingIndex: 0,
  weekdays,
  startTime,
  endTime,
});

const CONFLICT = {
  reasonCode: 'MEETING_CONFLICT',
  first: lecture('09:00', '09:50'),
  second: lab('09:30', '11:20'),
  sharedDates: MWF,
} as const satisfies Record<string, unknown>;

const INSUFFICIENT = {
  reasonCode: 'TRANSITION_TIME_INSUFFICIENT',
  earlier: lecture('09:00', '09:50'),
  later: lab('10:00', '11:50'),
  sharedDates: MWF,
  fromCampusId: NORTH,
  toCampusId: SOUTH,
  requiredMinutes: 15,
  availableMinutes: 10,
} as const satisfies Record<string, unknown>;

const accepts = (issue: unknown): boolean => ScheduleIssueSchema.safeParse(issue).success;

describe('createScheduleIssue', () => {
  it('accepts a meeting conflict between two overlapping timed meetings', () => {
    const conflict: ScheduleIssueInput = {
      reasonCode: 'MEETING_CONFLICT',
      first: {
        sectionId: LECTURE,
        meetingIndex: 0,
        weekdays: ['MONDAY'],
        startTime: '09:00',
        endTime: '09:50',
      },
      second: {
        sectionId: LAB,
        meetingIndex: 0,
        weekdays: ['MONDAY'],
        startTime: '09:30',
        endTime: '11:20',
      },
      sharedDates: { firstDate: '2026-08-24', lastDate: '2026-12-11', weekdays: ['MONDAY'] },
    };

    expect(createScheduleIssue(conflict)).toEqual(conflict);
    expect(ScheduleIssueSchema.parse(CONFLICT)).toEqual(CONFLICT);
  });

  it('rejects a conflict between back-to-back meetings, which half-open intervals allow', () => {
    expect(accepts({ ...CONFLICT, second: lab('09:50', '10:40') })).toBe(false);
  });

  it('rejects a conflict with an untimed meeting, or a meeting with itself', () => {
    expect(accepts({ ...CONFLICT, second: lab(null, null) })).toBe(false);
    expect(accepts({ ...CONFLICT, second: lecture('09:00', '09:50') })).toBe(false);
  });

  it('accepts an insufficient transition (AC08: 10 of 15 minutes)', () => {
    expect(accepts(INSUFFICIENT)).toBe(true);
  });

  it('rejects an insufficient transition whose minutes would pass', () => {
    expect(accepts({ ...INSUFFICIENT, requiredMinutes: 10 })).toBe(false);
  });

  it('rejects available minutes that differ from the gap, or overlapping meetings', () => {
    expect(accepts({ ...INSUFFICIENT, availableMinutes: 5 })).toBe(false);
    expect(accepts({ ...INSUFFICIENT, later: lab('09:40', '11:50'), availableMinutes: 0 })).toBe(
      false,
    );
  });

  it('rejects a transition within one campus, which needs none', () => {
    expect(accepts({ ...INSUFFICIENT, toCampusId: NORTH })).toBe(false);
  });

  it('accepts an undefined transition only with requiredMinutes null', () => {
    const undefinedPair = {
      ...INSUFFICIENT,
      reasonCode: 'TRANSITION_TIME_UNDEFINED',
      requiredMinutes: null,
    };

    expect(accepts(undefinedPair)).toBe(true);
    expect(accepts({ ...undefinedPair, requiredMinutes: 0 })).toBe(false);
    expect(accepts({ ...INSUFFICIENT, requiredMinutes: null })).toBe(false);
  });

  it('accepts MEETING_TIME_UNKNOWN against another meeting or against a constraint', () => {
    const pair = {
      reasonCode: 'MEETING_TIME_UNKNOWN',
      meeting: lab(null, null),
      otherMeeting: lecture('09:00', '09:50'),
      sharedDates: MWF,
      constraintIndex: null,
    };
    const constraint = { ...pair, otherMeeting: null, sharedDates: null, constraintIndex: 0 };

    expect(accepts(pair)).toBe(true);
    expect(accepts(constraint)).toBe(true);
    expect(accepts({ ...pair, constraintIndex: 0 })).toBe(false);
    expect(accepts({ ...constraint, constraintIndex: null })).toBe(false);
  });

  it('accepts MEETING_TIME_UNKNOWN for a meeting whose days are TBA but times are set (GR-02)', () => {
    const tbaDays = {
      reasonCode: 'MEETING_TIME_UNKNOWN',
      meeting: lab('10:00', '11:00', null),
      otherMeeting: lecture('09:00', '09:50'),
      sharedDates: MWF,
      constraintIndex: null,
    };

    expect(accepts(tbaDays)).toBe(true);
  });

  it('rejects MEETING_TIME_UNKNOWN for a meeting whose days and time are known', () => {
    const result = ScheduleIssueSchema.safeParse({
      reasonCode: 'MEETING_TIME_UNKNOWN',
      meeting: lab('10:00', '11:00'),
      otherMeeting: lecture('09:00', '09:50'),
      sharedDates: MWF,
      constraintIndex: null,
    });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'MEETING_TIME_UNKNOWN names a meeting whose days or time are to be announced',
    ]);
  });

  it('accepts MEETING_LOCATION_UNKNOWN for two timed meetings that do not overlap, or a constraint', () => {
    const location = {
      reasonCode: 'MEETING_LOCATION_UNKNOWN',
      meeting: lab('10:00', '11:00'),
      otherMeeting: lecture('09:00', '09:50'),
      sharedDates: MWF,
      constraintIndex: null,
    };

    expect(accepts(location)).toBe(true);
    expect(
      accepts({ ...location, otherMeeting: null, sharedDates: null, constraintIndex: 2 }),
    ).toBe(true);
  });

  it('rejects MEETING_LOCATION_UNKNOWN for overlapping meetings, which are a MEETING_CONFLICT', () => {
    const result = ScheduleIssueSchema.safeParse({
      reasonCode: 'MEETING_LOCATION_UNKNOWN',
      meeting: lab('09:30', '11:00'),
      otherMeeting: lecture('09:00', '09:50'),
      sharedDates: MWF,
      constraintIndex: null,
    });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'MEETING_LOCATION_UNKNOWN names two timed meetings that do not overlap',
    ]);
  });

  it('accepts a meeting in a hard unavailable block, and rejects one that only touches it', () => {
    const blocked = {
      reasonCode: 'UNAVAILABLE_TIME_CONFLICT',
      meeting: lecture('09:00', '09:50'),
      constraintIndex: 0,
      weekdays: ['FRIDAY'],
      blockStartTime: '00:00',
      blockEndTime: '24:00',
    };

    expect(accepts(blocked)).toBe(true);
    expect(accepts({ ...blocked, blockStartTime: '09:50', blockEndTime: '12:00' })).toBe(false);
    expect(accepts({ ...blocked, meeting: lecture(null, null) })).toBe(false);
  });

  it.each([
    { blockStartTime: '12:00', blockEndTime: '08:00' },
    { blockStartTime: '09:00', blockEndTime: '09:00' },
  ])('rejects an inverted or empty unavailable block %j', (block) => {
    const result = ScheduleIssueSchema.safeParse({
      reasonCode: 'UNAVAILABLE_TIME_CONFLICT',
      meeting: lecture('09:00', '09:50'),
      constraintIndex: 0,
      weekdays: ['FRIDAY'],
      ...block,
    });

    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      'blockStartTime must be earlier than blockEndTime',
    );
  });

  it('accepts the modality, campus, linked-section, and missing-data shapes', () => {
    expect(
      accepts({
        reasonCode: 'MODALITY_NOT_ALLOWED',
        sectionId: LAB,
        modality: 'IN_PERSON',
        constraintIndex: 1,
      }),
    ).toBe(true);
    expect(
      accepts({
        reasonCode: 'CAMPUS_NOT_ALLOWED',
        sectionId: LAB,
        meetingIndex: 0,
        campusId: SOUTH,
        constraintIndex: 2,
      }),
    ).toBe(true);
    expect(
      accepts({
        reasonCode: 'LINKED_SECTION_UNAVAILABLE',
        primarySectionId: LECTURE,
        componentName: 'Lab',
        courseId: PHYS_301L,
      }),
    ).toBe(true);
    expect(accepts({ reasonCode: 'SECTION_DATA_MISSING', courseId: PHYS_301L })).toBe(true);
  });

  it('rejects a non-schedule reason code, and a shape missing its evidence', () => {
    expect(accepts({ reasonCode: 'MIN_GRADE_NOT_MET', courseId: PHYS_301L })).toBe(false);
    expect(accepts({ reasonCode: 'SECTION_DATA_MISSING' })).toBe(false);
  });
});

describe('SCHEDULE_REASON_STATE', () => {
  it('maps conflicts on known data to FAIL and missing data to UNKNOWN', () => {
    expect(SCHEDULE_REASON_STATE).toEqual({
      MEETING_CONFLICT: 'FAIL',
      TRANSITION_TIME_INSUFFICIENT: 'FAIL',
      TRANSITION_TIME_UNDEFINED: 'UNKNOWN',
      MEETING_TIME_UNKNOWN: 'UNKNOWN',
      MEETING_LOCATION_UNKNOWN: 'UNKNOWN',
      UNAVAILABLE_TIME_CONFLICT: 'FAIL',
      MODALITY_NOT_ALLOWED: 'FAIL',
      CAMPUS_NOT_ALLOWED: 'FAIL',
      LINKED_SECTION_UNAVAILABLE: 'UNKNOWN',
      SECTION_DATA_MISSING: 'UNKNOWN',
    });
  });
});
