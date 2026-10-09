/**
 * @file Acceptance AC40 (#225): schedule options follow the student access rule, never
 * relax a hard constraint, and carry no free-text academic claim or registration wording. Only
 * the student and an assigned advisor are served; everyone else gets the 404 a missing student
 * gets, and a body naming a tenant, role, or user is 400 (ADR-0010 §6). A section inside a hard
 * unavailable time is never offered (ADR-0010 §3). Seats and registration are stated only as the
 * fixed limitation codes (ADR-0010 §5).
 * @requirement FR-07
 * @requirement FR-09
 * @requirement FR-18
 * @requirement NFR-04
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { Weekday } from '@caa/domain';
import {
  buildMeetingPattern,
  buildSection,
  buildUnavailableTime,
  HARD_STRENGTH,
  SYNTHETIC_COURSES,
  SYNTHETIC_TENANTS,
} from '@caa/test-kit';

import {
  type AcademicActor,
  buildAcademicApp,
  createAcademicWorld,
  MISSING_STUDENT_ID,
} from '../support/academic-endpoints-harness';
import { summarizeError } from '../support/api-harness';
import { acceptanceIt } from '../support/known-findings-declarations';
import {
  conflictIssues,
  findScheduleOptions,
  issueSectionIds,
  optionSectionIds,
  publishSections,
  resetScheduleWorld,
  scheduleRequest,
  sortedLimitations,
} from '../support/schedule-options-harness';

const { math102 } = SYNTHETIC_COURSES;
const MATH_ONLY = scheduleRequest([math102.id]);
/** DEMO-MATH 102 section 071: MWF 09:00–09:50. */
const MATH_MWF = buildSection({ courseId: math102.id }, 71);
/** DEMO-MATH 102 section 072: TTh 09:00–09:50. */
const MATH_TTH = buildSection(
  {
    courseId: math102.id,
    meetings: [buildMeetingPattern({ weekdays: [Weekday.Tuesday, Weekday.Thursday] })],
  },
  72,
);
/** The student can't attend Monday 08:00–10:00, as a hard constraint (constraint index 0). */
const NO_MONDAY_MORNING = scheduleRequest(
  [math102.id],
  [
    buildUnavailableTime({
      ...HARD_STRENGTH,
      weekdays: [Weekday.Monday],
      startTime: '08:00',
      endTime: '10:00',
    }),
  ],
);
const DENIED: readonly AcademicActor[] = ['unassignedAdvisor', 'otherStudent', 'tenantBAdmin'];
/** A string with no whitespace: an ID, enum, version, code, or timestamp, never prose. */
const TOKEN = /^\S+$/;
/**
 * The only places a response may carry catalog display text: each course's code and title, and
 * each campus name (ADR-0010 Amendment 7).
 */
const CATALOG_DISPLAY_PATHS: readonly string[] = [
  'data.courses[].code',
  'data.courses[].title',
  'data.campuses[].name',
];

/**
 * Lists every string in a JSON value with its path, for example `data.courses[].code`. Array
 * items share one path segment, `[]`.
 *
 * @param value - Parsed JSON.
 * @param path - The path of `value`; empty at the root.
 * @returns `[path, string]` pairs in document order.
 */
function stringLeaves(value: unknown, path = ''): readonly (readonly [string, string])[] {
  if (typeof value === 'string') {
    return [[path, value]];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => stringLeaves(item, `${path}[]`));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      stringLeaves(item, path === '' ? key : `${path}.${key}`),
    );
  }
  return [];
}

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const app = buildAcademicApp(world);

describe('AC40 schedule options follow the access rule and never relax a hard constraint', () => {
  beforeEach(() => {
    resetScheduleWorld(world);
    publishSections(world, [MATH_MWF, MATH_TTH]);
  });

  acceptanceIt('AC40', 'serves the student and the assigned advisor', async () => {
    const student = await findScheduleOptions(app, MATH_ONLY, { actor: 'student' });
    const advisor = await findScheduleOptions(app, MATH_ONLY, { actor: 'advisor' });

    expect(student).toMatchObject({
      statusCode: 200,
      body: { data: { outcome: 'OPTIONS_FOUND' } },
    });
    expect(advisor).toMatchObject({
      statusCode: 200,
      body: { data: { outcome: 'OPTIONS_FOUND' } },
    });
  });

  acceptanceIt(
    'AC40',
    'answers everyone else exactly as it answers a missing student',
    async () => {
      const served = await findScheduleOptions(app, MATH_ONLY);
      const denied = await Promise.all(
        DENIED.map((actor) => findScheduleOptions(app, MATH_ONLY, { actor })),
      );
      const missing = await Promise.all(
        DENIED.map((actor) =>
          findScheduleOptions(app, MATH_ONLY, { actor, studentId: MISSING_STUDENT_ID }),
        ),
      );

      expect(served.statusCode).toBe(200);
      expect(denied.map(summarizeError)).toMatchObject(
        DENIED.map(() => ({ statusCode: 404, bodyKeys: ['error'], code: 'NOT_FOUND' })),
      );
      expect(denied.map(summarizeError)).toEqual(missing.map(summarizeError));
      expect(JSON.stringify(denied.map((response) => response.body))).not.toContain(MATH_MWF.id);
    },
  );

  acceptanceIt(
    'AC40',
    'rejects a body that names a tenant, a role, or a user with 400',
    async () => {
      const extras = [
        { tenantId: SYNTHETIC_TENANTS.a.id },
        { role: 'ADMIN' },
        { userId: '20000000-0000-4000-8000-000000000002' },
      ];

      const responses = await Promise.all(
        extras.map((extra) => findScheduleOptions(app, { ...MATH_ONLY, ...extra })),
      );

      expect(responses.map(summarizeError)).toMatchObject(
        extras.map(() => ({ statusCode: 400, bodyKeys: ['error'], code: 'INVALID_REQUEST' })),
      );
    },
  );

  acceptanceIt('AC40', 'never offers a section inside a hard unavailable time', async () => {
    const response = await findScheduleOptions(app, NO_MONDAY_MORNING);

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
    expect(optionSectionIds(response)).toEqual([[MATH_TTH.id]]);
  });

  acceptanceIt(
    'AC40',
    'proves no plan, never a relaxed one, when every section is inside the hard unavailable time',
    async () => {
      publishSections(world, [MATH_MWF]);

      const response = await findScheduleOptions(app, NO_MONDAY_MORNING);

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
                  reasonCode: 'UNAVAILABLE_TIME_CONFLICT',
                },
              ],
              isMinimal: false,
              omittedCount: 0,
            },
          },
        },
      });
      expect(conflictIssues(response)).toMatchObject([
        { reasonCode: 'UNAVAILABLE_TIME_CONFLICT', constraintIndex: 0, weekdays: ['MONDAY'] },
      ]);
      expect(conflictIssues(response).map(issueSectionIds)).toEqual([[MATH_MWF.id]]);
    },
  );

  acceptanceIt(
    'AC40',
    'states seats and registration only as the fixed limitation codes',
    async () => {
      const response = await findScheduleOptions(app, MATH_ONLY);
      const prose = stringLeaves(response.body).filter(
        ([path, text]) => !TOKEN.test(text) && !CATALOG_DISPLAY_PATHS.includes(path),
      );

      expect(response.statusCode).toBe(200);
      expect(prose).toEqual([]);
      expect(sortedLimitations(response)).toEqual([
        'NOT_REGISTERED',
        'REGISTRATION_READINESS_NOT_CHECKED',
        'SEAT_AVAILABILITY_NOT_CHECKED',
      ]);
    },
  );
});
