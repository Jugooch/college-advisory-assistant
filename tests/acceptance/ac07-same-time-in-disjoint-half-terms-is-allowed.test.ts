/**
 * @file Acceptance AC07: classes that meet at the same time in disjoint half-terms are allowed if
 * the other constraints pass (planning/13). Two meetings overlap only when both their calendar
 * dates and their meeting instances overlap (planning/08 §Schedule model), so the same weekly
 * time in two halves of `SYNTHETIC_SCHEDULE_TERM` is one PASS option, and a single shared date is
 * enough to conflict.
 * @requirement FR-07
 * @requirement FR-09
 * @requirement FR-18
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { beforeEach, describe, expect } from 'vitest';

import {
  buildHalfTermSection,
  buildMeetingPattern,
  buildSection,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import { acceptanceIt } from '../support/known-findings-declarations';
import {
  conflictIssues,
  findScheduleOptions,
  issueSectionIds,
  optionSectionSets,
  publishSections,
  resetScheduleWorld,
  scheduleRequest,
  sharedWeekdays,
} from '../support/schedule-options-harness';

const { math102, phys201 } = SYNTHETIC_COURSES;
const BOTH = scheduleRequest([math102.id, phys201.id]);
/** DEMO-MATH 102: MWF 09:00–09:50, first half (2027-01-11 to 2027-03-05). */
const MATH_FIRST_HALF = buildHalfTermSection('first', { courseId: math102.id }, 21);
/** DEMO-PHYS 201: MWF 09:00–09:50, second half (2027-03-08 to 2027-05-07). */
const PHYS_SECOND_HALF = buildHalfTermSection('second', { courseId: phys201.id }, 22);
/** DEMO-PHYS 201: MWF 09:00–09:50, first half, the same dates as {@link MATH_FIRST_HALF}. */
const PHYS_FIRST_HALF = buildHalfTermSection('first', { courseId: phys201.id }, 23);
/** DEMO-PHYS 201: MWF 09:00–09:50 from Friday 2027-03-05, the first half's last day. */
const PHYS_FROM_MARCH_5 = buildSection(
  {
    courseId: phys201.id,
    startsOn: '2027-03-05',
    meetings: [buildMeetingPattern({ startsOn: '2027-03-05' })],
  },
  24,
);

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const app = buildAcademicApp(world);

describe('AC07 the same meeting time in disjoint half-terms is allowed', () => {
  beforeEach(() => {
    resetScheduleWorld(world);
  });

  acceptanceIt('AC07', 'allows the same weekly time in the two halves of the term', async () => {
    publishSections(world, [MATH_FIRST_HALF, PHYS_SECOND_HALF]);

    const response = await findScheduleOptions(app, BOTH);

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          outcome: 'OPTIONS_FOUND',
          searchComplete: true,
          options: [{ rank: 1, scheduleFeasibility: { state: 'PASS' } }],
        },
      },
    });
    expect(optionSectionSets(response)).toEqual([[MATH_FIRST_HALF.id, PHYS_SECOND_HALF.id]]);
  });

  acceptanceIt('AC07', 'rejects the same weekly time in the same half', async () => {
    publishSections(world, [MATH_FIRST_HALF, PHYS_FIRST_HALF]);

    const response = await findScheduleOptions(app, BOTH);

    expect(response).toMatchObject({
      statusCode: 200,
      body: { data: { outcome: 'NO_FEASIBLE_PLAN', searchComplete: true, options: [] } },
    });
    expect(conflictIssues(response)).toMatchObject([
      {
        reasonCode: 'MEETING_CONFLICT',
        sharedDates: { firstDate: '2027-01-11', lastDate: '2027-03-05' },
      },
    ]);
    expect(conflictIssues(response).map(sharedWeekdays)).toEqual([
      ['FRIDAY', 'MONDAY', 'WEDNESDAY'],
    ]);
    expect(conflictIssues(response).map(issueSectionIds)).toEqual([
      [MATH_FIRST_HALF.id, PHYS_FIRST_HALF.id],
    ]);
  });

  acceptanceIt('AC07', 'rejects halves that share a single meeting date', async () => {
    publishSections(world, [MATH_FIRST_HALF, PHYS_FROM_MARCH_5]);

    const response = await findScheduleOptions(app, BOTH);

    expect(response).toMatchObject({
      statusCode: 200,
      body: { data: { outcome: 'NO_FEASIBLE_PLAN', options: [] } },
    });
    expect(conflictIssues(response)).toMatchObject([
      {
        reasonCode: 'MEETING_CONFLICT',
        sharedDates: { firstDate: '2027-03-05', lastDate: '2027-03-05', weekdays: ['FRIDAY'] },
      },
    ]);
  });
});
