/**
 * @file Tests for the fixed synthetic term that section builders schedule in.
 */
import { describe, expect, it } from 'vitest';

import { buildTermCalendar } from '../builders/term.builder';
import { SYNTHETIC_SCHEDULE_TERM } from './synthetic-schedule-term';

describe('SYNTHETIC_SCHEDULE_TERM', () => {
  it('is spring 2027 of tenant A, split into two halves that share no date', () => {
    expect(SYNTHETIC_SCHEDULE_TERM).toEqual({
      termId: 'b0000000-0000-4000-8000-000000000004',
      termCode: '2027SP',
      startsOn: '2027-01-11',
      endsOn: '2027-05-07',
      timezone: 'America/Chicago',
      halves: {
        first: { startsOn: '2027-01-11', endsOn: '2027-03-05' },
        second: { startsOn: '2027-03-08', endsOn: '2027-05-07' },
      },
      daylightSavingStartsOn: '2027-03-14',
    });
  });

  it('matches the fourth term of the synthetic term calendar', () => {
    const term = buildTermCalendar()[3];

    expect([term?.id, term?.termCode, term?.startsOn, term?.endsOn]).toEqual([
      'b0000000-0000-4000-8000-000000000004',
      '2027SP',
      '2027-01-11',
      '2027-05-07',
    ]);
  });
});
