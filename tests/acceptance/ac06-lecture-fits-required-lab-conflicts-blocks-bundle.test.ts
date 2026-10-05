/**
 * @file Acceptance AC06: a lecture that fits, with a required lab that conflicts, blocks the bundle
 * (planning/13). Through `POST /v1/students/:studentId/schedule-options`: the lecture is never
 * offered without its lab, a conflicting lab is shown as a verified conflict, and a lab component
 * with no permitted section is UNKNOWN, never a bundle without the lab (ADR-0010 §5).
 * @requirement FR-07
 * @requirement FR-09
 * @requirement FR-18
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { type LinkedSectionGroup, Weekday } from '@caa/domain';
import {
  buildLinkedSectionComponent,
  buildLinkedSectionGroup,
  buildMeetingPattern,
  buildSection,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import { acceptanceIt } from '../support/known-findings';
import {
  conflictIssues,
  findScheduleOptions,
  issueSectionIds,
  optionSectionIds,
  publishSections,
  resetScheduleWorld,
  scheduleRequest,
} from '../support/schedule-options-harness';

const { phys201, phys201Lab } = SYNTHETIC_COURSES;
/** DEMO-PHYS 201 section 001: MWF 09:00–09:50 all term, on the north campus. */
const LECTURE = buildSection({ courseId: phys201.id }, 11);
/** Lab L01: Monday 09:30–12:20, overlapping the lecture's Monday meeting. */
const LAB_L01 = buildSection(
  {
    courseId: phys201Lab.id,
    sectionCode: 'L01',
    meetings: [
      buildMeetingPattern({ weekdays: [Weekday.Monday], startTime: '09:30', endTime: '12:20' }),
    ],
  },
  12,
);
/** Lab L02: Thursday 13:00–15:50, clear of the lecture. */
const LAB_L02 = buildSection(
  {
    courseId: phys201Lab.id,
    sectionCode: 'L02',
    meetings: [
      buildMeetingPattern({ weekdays: [Weekday.Thursday], startTime: '13:00', endTime: '15:50' }),
    ],
  },
  13,
);

/**
 * Links the lecture to a lab component permitting the given sections.
 *
 * @param permittedSectionIds - The lab sections the student may take with the lecture.
 * @returns The linked-section group.
 */
function lectureRequiresLab(permittedSectionIds: readonly string[]): LinkedSectionGroup {
  return buildLinkedSectionGroup({
    primarySectionId: LECTURE.id,
    components: [buildLinkedSectionComponent({ courseId: phys201Lab.id, permittedSectionIds })],
  });
}

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const app = buildAcademicApp(world);

describe('AC06 a lecture that fits with a required lab that conflicts blocks the bundle', () => {
  beforeEach(() => {
    resetScheduleWorld(world);
  });

  acceptanceIt(
    'AC06',
    'blocks the lecture when its only lab conflicts, with the conflict as evidence',
    async () => {
      publishSections(world, [LECTURE, LAB_L01], {
        linkedSectionGroups: [lectureRequiresLab([LAB_L01.id])],
      });

      const response = await findScheduleOptions(app, scheduleRequest([phys201.id]));

      expect(response).toMatchObject({
        statusCode: 200,
        body: {
          data: {
            outcome: 'NO_FEASIBLE_PLAN',
            searchComplete: true,
            options: [],
            conflictSet: {
              items: [
                { kind: 'SCHEDULE_FEASIBILITY', state: 'FAIL', reasonCode: 'MEETING_CONFLICT' },
              ],
              isMinimal: false,
              omittedCount: 0,
            },
          },
        },
      });
      expect(conflictIssues(response)).toMatchObject([
        {
          reasonCode: 'MEETING_CONFLICT',
          sharedDates: { firstDate: '2027-01-11', lastDate: '2027-05-03', weekdays: ['MONDAY'] },
        },
      ]);
      expect(conflictIssues(response).map(issueSectionIds)).toEqual([[LECTURE.id, LAB_L01.id]]);
    },
  );

  acceptanceIt('AC06', 'offers the lecture only with the lab that fits', async () => {
    publishSections(world, [LECTURE, LAB_L01, LAB_L02], {
      linkedSectionGroups: [lectureRequiresLab([LAB_L01.id, LAB_L02.id])],
    });

    const response = await findScheduleOptions(app, scheduleRequest([phys201.id]));

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          outcome: 'OPTIONS_FOUND',
          searchComplete: true,
          options: [
            {
              rank: 1,
              scheduleFeasibility: { kind: 'SCHEDULE_FEASIBILITY', state: 'PASS' },
              bundles: [{ courseId: phys201.id, creditsCountedHundredths: 500 }],
            },
          ],
        },
      },
    });
    expect(optionSectionIds(response)).toEqual([[LECTURE.id, LAB_L02.id]]);
  });

  acceptanceIt('AC06', 'needs verification when the lab component permits no section', async () => {
    publishSections(world, [LECTURE], { linkedSectionGroups: [lectureRequiresLab([])] });

    const response = await findScheduleOptions(app, scheduleRequest([phys201.id]));

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          outcome: 'NEEDS_VERIFICATION',
          searchComplete: false,
          options: [],
          conflictSet: null,
          unresolved: [
            {
              kind: 'SCHEDULE_FEASIBILITY',
              state: 'UNKNOWN',
              reasonCode: 'LINKED_SECTION_UNAVAILABLE',
            },
          ],
        },
      },
    });
  });
});
