/**
 * @file Tests for describing each constraint in words with its strength.
 */
import { describe, expect, it } from 'vitest';

import { createScheduleConstraintSet } from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

import { describeConstraints } from './constraint-wording';

describe('describeConstraints', () => {
  it('says every kind in words, with required or preferred and the priority', () => {
    const constraints = createScheduleConstraintSet([
      {
        kind: 'UNAVAILABLE_TIME',
        weekdays: ['FRIDAY'],
        startTime: '00:00',
        endTime: '24:00',
        strength: 'PREFERRED',
        priorityRank: 1,
      },
      {
        kind: 'UNAVAILABLE_TIME',
        weekdays: ['MONDAY', 'WEDNESDAY'],
        startTime: '09:00',
        endTime: '11:00',
        strength: 'HARD',
        priorityRank: null,
      },
      {
        kind: 'CREDIT_RANGE',
        minCreditsHundredths: 1200,
        maxCreditsHundredths: 1500,
        strength: 'HARD',
        priorityRank: null,
      },
      {
        kind: 'ALLOWED_MODALITIES',
        modalities: ['ONLINE_SYNCHRONOUS'],
        strength: 'PREFERRED',
        priorityRank: 2,
      },
      {
        kind: 'ALLOWED_CAMPUSES',
        campusIds: [syntheticId('campus', 1)],
        strength: 'PREFERRED',
        priorityRank: 3,
      },
    ]);

    expect(describeConstraints(constraints)).toEqual([
      { statement: 'Not available on Friday, all day.', strength: 'Preferred, priority 1' },
      {
        statement: 'Not available on Monday, Wednesday, from 09:00 to 11:00.',
        strength: 'Required',
      },
      { statement: 'Take between 12 and 15 credits.', strength: 'Required' },
      { statement: 'Only these formats: Online, at set times.', strength: 'Preferred, priority 2' },
      {
        statement: `Only these campuses: ${syntheticId('campus', 1)}.`,
        strength: 'Preferred, priority 3',
      },
    ]);
  });
});
