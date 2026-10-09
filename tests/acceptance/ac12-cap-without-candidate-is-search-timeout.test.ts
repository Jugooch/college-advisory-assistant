/**
 * @file Acceptance AC12: a solver that times out without a candidate reports `SEARCH_TIMEOUT`, not
 * "no feasible schedule" (planning/13). "Times out" means the counted work cap was reached
 * (ADR-0010 §1 and change control): one unit is one attempt to add a bundle, so two courses with
 * one bundle each need exactly two units. A cap of 1 stops before any candidate; a cap of 2, or
 * the default, finishes. A section dropped because its required lab has no permitted section
 * stays in `unresolved` as UNKNOWN `LINKED_SECTION_UNAVAILABLE` on `OPTIONS_FOUND` and
 * `SEARCH_TIMEOUT` (ADR-0010 Amendment 5, #305).
 * @requirement FR-07
 * @requirement FR-09
 * @requirement FR-18
 * @requirement NFR-01
 * @requirement NFR-07
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { Weekday } from '@caa/domain';
import {
  buildCourse,
  buildLinkedSectionComponent,
  buildLinkedSectionGroup,
  buildMeetingPattern,
  buildSection,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import {
  buildAcademicApp,
  createAcademicWorld,
  stateNoPrerequisite,
} from '../support/academic-endpoints-harness';
import { acceptanceIt } from '../support/known-findings-declarations';
import {
  findScheduleOptions,
  optionSectionIds,
  publishSections,
  resetScheduleWorld,
  scheduleRequest,
} from '../support/schedule-options-harness';

const { math102, phys201 } = SYNTHETIC_COURSES;
const BOTH = scheduleRequest([math102.id, phys201.id]);
/** DEMO-MATH 102, MWF 09:00–09:50: its only section. */
const MATH_MWF = buildSection({ courseId: math102.id }, 41);
/** DEMO-PHYS 201, TTh 09:00–09:50: its only section, compatible with {@link MATH_MWF}. */
const PHYS_TTH = buildSection(
  {
    courseId: phys201.id,
    meetings: [buildMeetingPattern({ weekdays: [Weekday.Tuesday, Weekday.Thursday] })],
  },
  42,
);

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const cappedAtOne = buildAcademicApp(world, { solverWorkCap: 1 });
const cappedAtTwo = buildAcademicApp(world, { solverWorkCap: 2 });
const defaultCap = buildAcademicApp(world);

describe('AC12 a search capped before any candidate is SEARCH_TIMEOUT', () => {
  beforeEach(() => {
    resetScheduleWorld(world);
    publishSections(world, [MATH_MWF, PHYS_TTH]);
  });

  acceptanceIt(
    'AC12',
    'reports SEARCH_TIMEOUT, never NO_FEASIBLE_PLAN, when the cap stops before a candidate',
    async () => {
      const response = await findScheduleOptions(cappedAtOne, BOTH);

      expect(response).toMatchObject({
        statusCode: 200,
        body: {
          data: {
            outcome: 'SEARCH_TIMEOUT',
            searchComplete: false,
            options: [],
            conflictSet: null,
            unresolved: [],
            pinnedInputs: { solverWorkCap: 1 },
          },
        },
      });
    },
  );

  acceptanceIt('AC12', 'completes a search that needs exactly the cap', async () => {
    const response = await findScheduleOptions(cappedAtTwo, BOTH);

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          outcome: 'OPTIONS_FOUND',
          searchComplete: true,
          options: [{ rank: 1, scheduleFeasibility: { state: 'PASS' } }],
          pinnedInputs: { solverWorkCap: 2 },
        },
      },
    });
  });

  acceptanceIt('AC12', 'finds the option under the documented default cap', async () => {
    const response = await findScheduleOptions(defaultCap, BOTH);

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          outcome: 'OPTIONS_FOUND',
          searchComplete: true,
          pinnedInputs: { solverWorkCap: 3_000_000 },
        },
      },
    });
  });
});

/** DEMO-PHYS 201M: a lab whose credits are included in DEMO-PHYS 201. */
const LAB = buildCourse(
  { label: 'DEMO-PHYS 201M', creditsHundredths: 100, creditsIncludedInCourseId: phys201.id },
  31,
);
/** DEMO-PHYS 201 section 001, MWF 09:00-09:50: its required lab has no permitted section. */
const PHYS_DROPPED = buildSection({ courseId: phys201.id, sectionCode: '001' }, 43);
const DROPPED_RESULT = {
  kind: 'SCHEDULE_FEASIBILITY',
  state: 'UNKNOWN',
  reasonCode: 'LINKED_SECTION_UNAVAILABLE',
};

describe('AC12 a dropped linked section stays unresolved while the search runs', () => {
  beforeEach(() => {
    resetScheduleWorld(world);
    world.courses = [...Object.values(SYNTHETIC_COURSES), LAB];
    stateNoPrerequisite(world, LAB.id);
    publishSections(world, [MATH_MWF, PHYS_DROPPED, PHYS_TTH], {
      linkedSectionGroups: [
        buildLinkedSectionGroup({
          primarySectionId: PHYS_DROPPED.id,
          components: [buildLinkedSectionComponent({ courseId: LAB.id, permittedSectionIds: [] })],
        }),
      ],
    });
  });

  acceptanceIt(
    'AC12',
    'lists the dropped section as UNKNOWN LINKED_SECTION_UNAVAILABLE on OPTIONS_FOUND',
    async () => {
      const response = await findScheduleOptions(defaultCap, BOTH);

      expect(response).toMatchObject({
        statusCode: 200,
        body: {
          data: {
            outcome: 'OPTIONS_FOUND',
            searchComplete: true,
            conflictSet: null,
            unresolved: [DROPPED_RESULT],
          },
        },
      });
      expect(optionSectionIds(response)).toEqual([[MATH_MWF.id, PHYS_TTH.id]]);
    },
  );

  acceptanceIt(
    'AC12',
    'lists the dropped section on SEARCH_TIMEOUT, never NO_FEASIBLE_PLAN',
    async () => {
      const response = await findScheduleOptions(cappedAtOne, BOTH);

      expect(response).toMatchObject({
        statusCode: 200,
        body: {
          data: {
            outcome: 'SEARCH_TIMEOUT',
            searchComplete: false,
            options: [],
            conflictSet: null,
            unresolved: [DROPPED_RESULT],
          },
        },
      });
    },
  );

  acceptanceIt('AC12', 'keeps unresolved empty when no section is dropped', async () => {
    publishSections(world, [MATH_MWF, PHYS_TTH]);

    const response = await findScheduleOptions(defaultCap, BOTH);

    expect(response).toMatchObject({
      statusCode: 200,
      body: { data: { outcome: 'OPTIONS_FOUND', unresolved: [] } },
    });
  });
});
