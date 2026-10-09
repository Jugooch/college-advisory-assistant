/**
 * @file Acceptance AC08: back-to-back classes that need cross-campus travel are rejected when the
 * configured transition time is insufficient (planning/13). A gap equal to the required time
 * passes, and a campus pair the institution hasn't configured is UNKNOWN
 * `TRANSITION_TIME_UNDEFINED`, never an assumed zero (ADR-0010 §8).
 * @requirement FR-07
 * @requirement FR-09
 * @requirement FR-18
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { MeetingLocationKind } from '@caa/domain';
import {
  buildCampusTransition,
  buildMeetingPattern,
  buildSection,
  SYNTHETIC_CAMPUSES,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import { acceptanceIt } from '../support/known-findings-declarations';
import {
  conflictIssues,
  findScheduleOptions,
  issueSectionIds,
  optionIssues,
  optionSectionSets,
  publishSections,
  publishTransitions,
  resetScheduleWorld,
  scheduleRequest,
} from '../support/schedule-options-harness';

const { math102, phys201 } = SYNTHETIC_COURSES;
const { north, south } = SYNTHETIC_CAMPUSES;
const BOTH = scheduleRequest([math102.id, phys201.id]);
/** DEMO-MATH 102 on the north campus, MWF 09:00–09:50. */
const NORTH_AT_9 = buildSection({ courseId: math102.id }, 31);
/** DEMO-PHYS 201 on the south campus, MWF 10:00–10:50: ten minutes after the north class. */
const SOUTH_AT_10 = buildSection(
  {
    courseId: phys201.id,
    campusId: south.id,
    meetings: [
      buildMeetingPattern({
        startTime: '10:00',
        endTime: '10:50',
        location: { kind: MeetingLocationKind.OnCampus, campusId: south.id, room: null },
      }),
    ],
  },
  32,
);

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const app = buildAcademicApp(world);

describe('AC08 insufficient cross-campus transition time is rejected', () => {
  beforeEach(() => {
    resetScheduleWorld(world);
    publishSections(world, [NORTH_AT_9, SOUTH_AT_10]);
  });

  acceptanceIt(
    'AC08',
    'rejects ten minutes between campuses when fifteen are required',
    async () => {
      publishTransitions(world, [buildCampusTransition(north.id, south.id, 15)]);

      const response = await findScheduleOptions(app, BOTH);

      expect(response).toMatchObject({
        statusCode: 200,
        body: {
          data: {
            outcome: 'NO_FEASIBLE_PLAN',
            searchComplete: true,
            options: [],
            conflictSet: {
              items: [
                {
                  kind: 'SCHEDULE_FEASIBILITY',
                  state: 'FAIL',
                  reasonCode: 'TRANSITION_TIME_INSUFFICIENT',
                },
              ],
              isMinimal: false,
            },
          },
        },
      });
      expect(conflictIssues(response)).toMatchObject([
        {
          reasonCode: 'TRANSITION_TIME_INSUFFICIENT',
          fromCampusId: north.id,
          toCampusId: south.id,
          requiredMinutes: 15,
          availableMinutes: 10,
        },
      ]);
      expect(conflictIssues(response).map(issueSectionIds)).toEqual([
        [NORTH_AT_9.id, SOUTH_AT_10.id],
      ]);
    },
  );

  acceptanceIt('AC08', 'allows a gap exactly equal to the required transition time', async () => {
    publishTransitions(world, [buildCampusTransition(north.id, south.id, 10)]);

    const response = await findScheduleOptions(app, BOTH);

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          outcome: 'OPTIONS_FOUND',
          options: [{ rank: 1, scheduleFeasibility: { state: 'PASS' } }],
          pinnedInputs: { campusTransitionVersion: 'demo-2026.1' },
        },
      },
    });
    expect(optionSectionSets(response)).toEqual([[NORTH_AT_9.id, SOUTH_AT_10.id]]);
  });

  acceptanceIt('AC08', 'is unknown, never feasible, when the pair is not configured', async () => {
    publishTransitions(world, [buildCampusTransition(south.id, north.id, 10)]);

    const response = await findScheduleOptions(app, BOTH);

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          outcome: 'OPTIONS_FOUND',
          options: [
            {
              rank: 1,
              scheduleFeasibility: { state: 'UNKNOWN', reasonCode: 'TRANSITION_TIME_UNDEFINED' },
              aggregate: 'NEEDS_VERIFICATION',
            },
          ],
        },
      },
    });
    expect(optionIssues(response, 1)).toMatchObject([
      {
        reasonCode: 'TRANSITION_TIME_UNDEFINED',
        fromCampusId: north.id,
        toCampusId: south.id,
        requiredMinutes: null,
        availableMinutes: 10,
      },
    ]);
  });

  acceptanceIt('AC08', 'is unknown when the tenant has no transition table at all', async () => {
    const response = await findScheduleOptions(app, BOTH);

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          outcome: 'OPTIONS_FOUND',
          options: [
            { scheduleFeasibility: { state: 'UNKNOWN', reasonCode: 'TRANSITION_TIME_UNDEFINED' } },
          ],
          pinnedInputs: { campusTransitionVersion: null },
        },
      },
    });
  });
});
