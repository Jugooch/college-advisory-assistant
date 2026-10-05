/**
 * @file Acceptance AC32 (proposed, #225): the scheduling steps of the first vertical slice
 * (planning/14 §First vertical slice), through `POST /v1/students/:studentId/schedule-options`.
 * Four published sections including a conflict give exactly two options with evidence; a failing
 * prerequisite grade blocks the prerequisite dimension of every option without changing the
 * sections (ADR-0010 §2); a removed meeting time shows UNKNOWN, never PASS; and a stale section
 * snapshot is referred with 409 before any option is computed.
 * @requirement FR-07
 * @requirement FR-09
 * @requirement FR-18
 * @requirement NFR-04
 * @see docs/planning/14-delivery-roadmap-and-backlog.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { MeetingLocationKind, Weekday } from '@caa/domain';
import {
  buildMeetingPattern,
  buildSection,
  buildTbaMeeting,
  completedAttempt,
  letter,
  SYNTHETIC_CAMPUSES,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import { summarizeError } from '../support/api-harness';
import { acceptanceIt } from '../support/known-findings';
import {
  courseResultsOf,
  findScheduleOptions,
  optionIssues,
  optionSectionSets,
  publishSections,
  resetScheduleWorld,
  scheduleRequest,
} from '../support/schedule-options-harness';

const { math102, phys201 } = SYNTHETIC_COURSES;
const BOTH = scheduleRequest([math102.id, phys201.id]);
const TTH = [Weekday.Tuesday, Weekday.Thursday];
/** DEMO-MATH 102: A1 MWF 09:00–09:50 and A2 TTh 09:00–09:50. */
const A1 = buildSection({ courseId: math102.id }, 51);
const A2 = buildSection(
  { courseId: math102.id, meetings: [buildMeetingPattern({ weekdays: TTH })] },
  52,
);
/** DEMO-PHYS 201: B1 MWF 09:00–09:50 and B2 TTh 09:00–09:50. A1 × B1 and A2 × B2 conflict. */
const B1 = buildSection({ courseId: phys201.id }, 53);
const B2 = buildSection(
  { courseId: phys201.id, meetings: [buildMeetingPattern({ weekdays: TTH })] },
  54,
);
/** B2 with its meeting time removed: still TTh on the north campus, times to be announced. */
const B2_TIME_REMOVED = buildSection(
  {
    courseId: phys201.id,
    meetings: [
      buildTbaMeeting({
        weekdays: TTH,
        location: {
          kind: MeetingLocationKind.OnCampus,
          campusId: SYNTHETIC_CAMPUSES.north.id,
          room: null,
        },
      }),
    ],
  },
  54,
);

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const app = buildAcademicApp(world);

describe('AC32 the scheduling steps of the first vertical slice', () => {
  beforeEach(() => {
    resetScheduleWorld(world);
    publishSections(world, [A1, A2, B1, B2]);
  });

  acceptanceIt('AC32', 'gives exactly two options from four sections with conflicts', async () => {
    const response = await findScheduleOptions(app, BOTH);

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          outcome: 'OPTIONS_FOUND',
          searchComplete: true,
          conflictSet: null,
          options: [
            { rank: 1, scheduleFeasibility: { state: 'PASS' }, aggregate: 'VALIDATED' },
            { rank: 2, scheduleFeasibility: { state: 'PASS' }, aggregate: 'VALIDATED' },
          ],
        },
      },
    });
    expect(optionSectionSets(response)).toEqual([
      [A1.id, B2.id],
      [A2.id, B1.id],
    ]);
    expect(courseResultsOf(response, math102.id)).toMatchObject([
      { prerequisite: { state: 'PASS' } },
      { prerequisite: { state: 'PASS' } },
    ]);
  });

  acceptanceIt(
    'AC32',
    'blocks the prerequisite on every option after the grade changes to a D',
    async () => {
      resetScheduleWorld(world, { attempts: [completedAttempt({ grade: letter('D') })] });
      publishSections(world, [A1, A2, B1, B2]);

      const response = await findScheduleOptions(app, BOTH);

      expect(response).toMatchObject({
        statusCode: 200,
        body: {
          data: {
            outcome: 'OPTIONS_FOUND',
            options: [{ aggregate: 'BLOCKED' }, { aggregate: 'BLOCKED' }],
          },
        },
      });
      expect(optionSectionSets(response)).toEqual([
        [A1.id, B2.id],
        [A2.id, B1.id],
      ]);
      expect(courseResultsOf(response, math102.id)).toMatchObject([
        { prerequisite: { state: 'FAIL', reasonCode: 'MIN_GRADE_NOT_MET' } },
        { prerequisite: { state: 'FAIL', reasonCode: 'MIN_GRADE_NOT_MET' } },
      ]);
    },
  );

  acceptanceIt(
    'AC32',
    'shows UNKNOWN, never PASS, where a removed meeting time could conflict',
    async () => {
      publishSections(world, [A1, A2, B1, B2_TIME_REMOVED]);

      const response = await findScheduleOptions(app, BOTH);

      expect(response).toMatchObject({
        statusCode: 200,
        body: {
          data: {
            outcome: 'OPTIONS_FOUND',
            options: [
              { rank: 1, scheduleFeasibility: { state: 'PASS' } },
              { rank: 2, scheduleFeasibility: { state: 'PASS' } },
              {
                rank: 3,
                scheduleFeasibility: { state: 'UNKNOWN', reasonCode: 'MEETING_TIME_UNKNOWN' },
                aggregate: 'NEEDS_VERIFICATION',
              },
            ],
          },
        },
      });
      expect(optionSectionSets(response)).toEqual([
        [A1.id, B2.id],
        [A2.id, B1.id],
        [A2.id, B2.id],
      ]);
      expect(optionIssues(response, 3)).toMatchObject([
        { reasonCode: 'MEETING_TIME_UNKNOWN', meeting: { sectionId: B2.id } },
      ]);
    },
  );

  acceptanceIt('AC32', 'refers a stale section snapshot with 409 STALE_SOURCE', async () => {
    publishSections(world, [A1, A2, B1, B2], { sourceEffectiveAt: '2026-08-31T11:59:59.999Z' });

    const response = await findScheduleOptions(app, BOTH);

    expect(summarizeError(response)).toMatchObject({
      statusCode: 409,
      bodyKeys: ['error'],
      code: 'STALE_SOURCE',
    });
  });
});
