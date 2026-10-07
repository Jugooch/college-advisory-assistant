/**
 * @file Tests for the meeting wording: values shown as text, and unannounced values said so.
 */
import { describe, expect, it } from 'vitest';

import { SYNTHETIC_CAMPUSES } from '@caa/test-kit';

import { indexCampuses } from '@/shared/utils/campus-display';

import { describeDateRange, describeMeeting, formatClockTime } from './meeting-wording';

const { north } = SYNTHETIC_CAMPUSES;
const NAMES = indexCampuses([{ id: north.id, name: north.name }]);

const BASE = {
  weekdays: ['TUESDAY', 'THURSDAY'],
  startTime: '13:30',
  endTime: '14:45',
  startsOn: '2026-08-24',
  endsOn: '2026-12-11',
  excludedDates: ['2026-11-26'],
  location: { kind: 'ONLINE' },
} as const;

describe('meeting wording', () => {
  it('formats times and date ranges', () => {
    expect(formatClockTime('13:30')).toBe('1:30 PM');
    expect(describeDateRange('2026-08-24', '2026-12-11')).toBe('Aug 24, 2026 to Dec 11, 2026');
  });

  it('describes days, time, dates, skipped dates, and place', () => {
    expect(describeMeeting({ ...BASE }, NAMES)).toBe(
      'Tuesday, Thursday, 1:30 PM to 2:45 PM, Aug 24, 2026 to Dec 11, 2026, not on Nov 26, 2026, online',
    );
  });

  it('says so when days, time, or place are to be announced, never guessing', () => {
    const text = describeMeeting(
      {
        ...BASE,
        weekdays: null,
        startTime: null,
        endTime: null,
        excludedDates: [],
        location: null,
      },
      NAMES,
    );
    expect(text).toBe(
      'days to be announced, time to be announced, Aug 24, 2026 to Dec 11, 2026, location to be announced',
    );
  });

  it('shows an on-campus room with the campus name', () => {
    const location = { kind: 'ON_CAMPUS', campusId: north.id, room: 'SCI 2' } as const;
    expect(describeMeeting({ ...BASE, excludedDates: [], location }, NAMES)).toContain(
      `campus ${north.name}, room SCI 2`,
    );
  });

  it('shows the ID with a note when the campus has no name', () => {
    const location = { kind: 'ON_CAMPUS', campusId: north.id, room: null } as const;
    expect(describeMeeting({ ...BASE, excludedDates: [], location }, indexCampuses([]))).toContain(
      `campus ${north.id} (name unavailable)`,
    );
  });
});
