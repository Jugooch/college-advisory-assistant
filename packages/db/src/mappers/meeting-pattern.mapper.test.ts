/**
 * @file Tests for the section meeting row mapper.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { MeetingLocationKind, Weekday } from '@caa/domain';

import type { SectionMeetingRow } from '../tables/section-meeting.table';
import { toMeetingPattern } from './meeting-pattern.mapper';

const CAMPUS_ID = '3c4d5e6f-7081-4a92-8b3c-4d5e6f708192';

const ROW: SectionMeetingRow = {
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  sectionId: 'd4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70',
  position: 0,
  weekdays: [Weekday.Monday, Weekday.Wednesday],
  startTime: '09:00:00',
  endTime: '09:50:00',
  startsOn: '2026-08-24',
  endsOn: '2026-12-18',
  excludedDates: ['2026-09-07'],
  locationKind: MeetingLocationKind.OnCampus,
  locationCampusId: CAMPUS_ID,
  room: 'SCI 204',
};

describe('toMeetingPattern', () => {
  it('keeps the domain fields, with times as HH:MM', () => {
    expect(toMeetingPattern(ROW)).toEqual({
      weekdays: ['MONDAY', 'WEDNESDAY'],
      startTime: '09:00',
      endTime: '09:50',
      startsOn: '2026-08-24',
      endsOn: '2026-12-18',
      excludedDates: ['2026-09-07'],
      location: { kind: 'ON_CAMPUS', campusId: CAMPUS_ID, room: 'SCI 204' },
    });
  });

  it('keeps a to-be-announced meeting as nulls, never midnight', () => {
    const row = {
      ...ROW,
      weekdays: null,
      startTime: null,
      endTime: null,
      locationKind: null,
      locationCampusId: null,
      room: null,
    };

    expect(toMeetingPattern(row)).toMatchObject({
      weekdays: null,
      startTime: null,
      endTime: null,
      location: null,
    });
  });

  it('maps an online location without a campus', () => {
    const row = {
      ...ROW,
      locationKind: MeetingLocationKind.Online,
      locationCampusId: null,
      room: null,
    };

    expect(toMeetingPattern(row).location).toEqual({ kind: 'ONLINE' });
  });

  it('rejects a stored time with seconds instead of dropping them', () => {
    expect(() => toMeetingPattern({ ...ROW, startTime: '09:00:30' })).toThrow(ZodError);
  });

  it('rejects a stored on-campus meeting with no campus', () => {
    expect(() => toMeetingPattern({ ...ROW, locationCampusId: null })).toThrow(ZodError);
  });
});
