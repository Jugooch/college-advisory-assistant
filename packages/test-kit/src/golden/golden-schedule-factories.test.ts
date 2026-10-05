/**
 * @file Tests for the scheduling golden case factories: the documented input defaults, section
 *   dates that bound their meeting, and the expectation shapes.
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { describe, expect, it } from 'vitest';

import { ScheduleOutcome } from '@caa/domain';

import { SYNTHETIC_COURSES } from '../fixtures/synthetic-courses';
import {
  expectNoPlan,
  expectOneOption,
  SCHEDULE_PASS,
  scheduleInputs,
  scheduleSection,
  sectionIdsOf,
} from './golden-schedule-factories';

const { math102 } = SYNTHETIC_COURSES;

describe('scheduleSection', () => {
  it('bounds the meeting by the section dates unless the meeting says otherwise', () => {
    const half = scheduleSection(math102.id, 1, {
      section: { startsOn: '2027-03-08', endsOn: '2027-05-07' },
    });
    const own = scheduleSection(math102.id, 2, {
      meeting: { startsOn: '2027-03-15' },
      section: { startsOn: '2027-03-08' },
    });

    expect(half).toMatchObject({
      courseId: math102.id,
      startsOn: '2027-03-08',
      meetings: [{ startsOn: '2027-03-08', endsOn: '2027-05-07', startTime: '09:00' }],
    });
    expect(own.meetings).toMatchObject([{ startsOn: '2027-03-15', endsOn: '2027-05-07' }]);
  });

  it('lists section IDs ascending whatever order they are given in', () => {
    const first = scheduleSection(math102.id, 1);
    const second = scheduleSection(math102.id, 2);

    expect(sectionIdsOf(second, first)).toEqual([first.id, second.id]);
  });
});

describe('scheduleInputs', () => {
  it('uses an empty transition table, no constraints, bounds 1.00 to 18.00, and the default cap', () => {
    const inputs = scheduleInputs({ requestedCourseIds: [math102.id], sections: [] });

    expect(inputs).toMatchObject({
      transitionPolicy: { version: 'demo-2026.1', transitions: [] },
      constraints: [],
      creditSelections: [],
      academicPolicy: {
        termCreditBounds: { minCreditsHundredths: 100, maxCreditsHundredths: 1800 },
      },
      workCap: 3_000_000,
    });
  });

  it('states no table at all as null', () => {
    expect(
      scheduleInputs({ requestedCourseIds: [math102.id], sections: [], transitions: null }),
    ).toMatchObject({ transitionPolicy: null });
  });
});

describe('expectation factories', () => {
  it('expects one complete option, or a complete proof of no plan', () => {
    const section = scheduleSection(math102.id, 1);

    expect(expectOneOption(sectionIdsOf(section))).toEqual({
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: true,
      options: [{ sectionIds: [section.id], scheduleFeasibility: SCHEDULE_PASS }],
      conflictSet: null,
      unresolved: [],
    });
    expect(expectNoPlan([SCHEDULE_PASS])).toMatchObject({
      outcome: ScheduleOutcome.NoFeasiblePlan,
      searchComplete: true,
      conflictSet: { omittedCount: 0 },
    });
  });
});
