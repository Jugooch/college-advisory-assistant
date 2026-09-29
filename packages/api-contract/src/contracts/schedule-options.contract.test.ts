/**
 * @file Tests for the schedule-options endpoint and response: each outcome and its evidence.
 */
import { describe, expect, it } from 'vitest';

import {
  findScheduleOptionsEndpoint,
  ScheduleOptionsResponseSchema,
} from './schedule-options.contract';

const PHYS_301 = 'c0a5e000-0000-4000-8000-000000000301';
const LECTURE_ID = '5ec71010-0000-4000-8000-000000000001';

const section = (sectionId: string): object => ({
  sectionId,
  courseId: PHYS_301,
  sectionCode: sectionId.slice(-3),
  modality: 'ONLINE_ASYNCHRONOUS',
  campusId: null,
  startsOn: '2026-08-24',
  endsOn: '2026-12-11',
  meetings: [],
  countsCredits: true,
});

const option = (rank: number, sectionId: string, schedule = 'PASS'): object => ({
  rank,
  bundles: [{ courseId: PHYS_301, sections: [section(sectionId)], creditsCountedHundredths: 400 }],
  scheduleFeasibility:
    schedule === 'PASS'
      ? { kind: 'SCHEDULE_FEASIBILITY', state: 'PASS' }
      : // TODO(#212): use MEETING_TIME_UNKNOWN once the schedule reason codes land.
        { kind: 'SCHEDULE_FEASIBILITY', state: 'UNKNOWN', reasonCode: 'COURSE_NOT_IN_CATALOG' },
  courseResults: [
    {
      courseId: PHYS_301,
      prerequisite: null,
      applicability: { kind: 'REQUIREMENT_APPLICABILITY', state: 'PASS' },
    },
  ],
  setResults: {
    allocation: [{ kind: 'REQUIREMENT_ALLOCATION', state: 'PASS' }],
    creditLoad: {
      kind: 'CREDIT_LOAD',
      state: 'PASS',
      evidence: {
        rulesetVersion: 'demo-2026.1',
        decisiveLeaves: [],
        creditLoad: {
          totalCreditsHundredths: 400,
          minCreditsHundredths: 0,
          maxCreditsHundredths: 1800,
        },
      },
    },
  },
  unmetPreferences: [],
  aggregate: schedule === 'PASS' ? 'VALIDATED' : 'NEEDS_VERIFICATION',
});

const sectionId = (seed: number): string => `5ec71010-0000-4000-8000-00000000000${String(seed)}`;

const OPTIONS_FOUND = {
  outcome: 'OPTIONS_FOUND',
  searchComplete: true,
  courseIds: [PHYS_301],
  options: [option(1, LECTURE_ID), option(2, sectionId(2))],
  conflictSet: null,
  unresolved: [],
  limitations: [
    'SEAT_AVAILABILITY_NOT_CHECKED',
    'REGISTRATION_READINESS_NOT_CHECKED',
    'NOT_REGISTERED',
  ],
  pinnedInputs: {
    studentSnapshotId: '3c4d5e6f-0000-4000-8000-000000000001',
    studentRecordEffectiveAt: '2026-09-20T07:30:00.000-05:00',
    auditRecordEffectiveAt: '2026-09-20T07:15:00.000-05:00',
    auditSource: 'demo-audit',
    auditVersion: 'audit_demo_r7',
    rulesetVersion: 'demo-2026.1',
    sectionSnapshotId: '5a7b0000-0000-4000-8000-000000000001',
    campusTransitionVersion: 'demo-2026.1',
    solverWorkCap: 3_000_000,
    constraintHash: `sha256:${'0a'.repeat(32)}`,
  },
  courses: [],
};

const CONFLICT = {
  kind: 'CREDIT_LOAD',
  state: 'FAIL',
  reasonCode: 'CREDIT_LIMIT_EXCEEDED',
  evidence: {
    rulesetVersion: 'demo-2026.1',
    decisiveLeaves: [],
    creditLoad: {
      totalCreditsHundredths: 2000,
      minCreditsHundredths: 0,
      maxCreditsHundredths: 1800,
    },
  },
};

const NO_FEASIBLE_PLAN = {
  ...OPTIONS_FOUND,
  outcome: 'NO_FEASIBLE_PLAN',
  options: [],
  conflictSet: { items: [CONFLICT], isMinimal: false, omittedCount: 0 },
};

const SEARCH_TIMEOUT = {
  ...OPTIONS_FOUND,
  outcome: 'SEARCH_TIMEOUT',
  searchComplete: false,
  options: [],
};

// TODO(#212): use SECTION_DATA_MISSING once the schedule reason codes land.
const MISSING = {
  kind: 'SCHEDULE_FEASIBILITY',
  state: 'UNKNOWN',
  reasonCode: 'COURSE_NOT_IN_CATALOG',
};

const NEEDS_VERIFICATION = {
  ...SEARCH_TIMEOUT,
  outcome: 'NEEDS_VERIFICATION',
  unresolved: [MISSING],
};

const accepts = (payload: unknown): boolean =>
  ScheduleOptionsResponseSchema.safeParse(payload).success;

describe('findScheduleOptionsEndpoint', () => {
  it('declares POST /v1/students/:studentId/schedule-options', () => {
    expect(findScheduleOptionsEndpoint).toMatchObject({
      method: 'POST',
      path: '/v1/students/:studentId/schedule-options',
    });
  });
});

describe('ScheduleOptionsResponseSchema outcomes', () => {
  it.each([
    ['OPTIONS_FOUND, complete', OPTIONS_FOUND],
    ['OPTIONS_FOUND, search incomplete', { ...OPTIONS_FOUND, searchComplete: false }],
    ['NO_FEASIBLE_PLAN with a conflict set', NO_FEASIBLE_PLAN],
    ['SEARCH_TIMEOUT with no options', SEARCH_TIMEOUT],
    ['NEEDS_VERIFICATION with unresolved data', NEEDS_VERIFICATION],
  ])('accepts %s', (_name, payload) => {
    expect(ScheduleOptionsResponseSchema.parse(payload)).toEqual(payload);
  });

  it.each([
    ['OPTIONS_FOUND with no options', { ...OPTIONS_FOUND, options: [] }],
    [
      'OPTIONS_FOUND with a conflict set',
      { ...OPTIONS_FOUND, conflictSet: NO_FEASIBLE_PLAN.conflictSet },
    ],
    ['NO_FEASIBLE_PLAN with no conflict set', { ...NO_FEASIBLE_PLAN, conflictSet: null }],
    ['NO_FEASIBLE_PLAN from an incomplete search', { ...NO_FEASIBLE_PLAN, searchComplete: false }],
    ['NO_FEASIBLE_PLAN with an option', { ...NO_FEASIBLE_PLAN, options: [option(1, LECTURE_ID)] }],
    ['SEARCH_TIMEOUT from a complete search', { ...SEARCH_TIMEOUT, searchComplete: true }],
    [
      'SEARCH_TIMEOUT with a conflict set',
      { ...SEARCH_TIMEOUT, conflictSet: NO_FEASIBLE_PLAN.conflictSet },
    ],
    ['NEEDS_VERIFICATION with nothing unresolved', { ...NEEDS_VERIFICATION, unresolved: [] }],
    ['SEARCH_TIMEOUT with unresolved data', { ...SEARCH_TIMEOUT, unresolved: [MISSING] }],
  ])('rejects %s', (_name, payload) => {
    expect(accepts(payload)).toBe(false);
  });

  it('rejects a repeated requested course even when there are no options', () => {
    const result = ScheduleOptionsResponseSchema.safeParse({
      ...SEARCH_TIMEOUT,
      courseIds: [PHYS_301, PHYS_301],
    });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'courseIds must not repeat a course',
    ]);
  });
});

describe('ScheduleOptionsResponseSchema options', () => {
  it('accepts three options and rejects four', () => {
    const three = [option(1, sectionId(1)), option(2, sectionId(2)), option(3, sectionId(3))];

    expect(accepts({ ...OPTIONS_FOUND, options: three })).toBe(true);
    expect(accepts({ ...OPTIONS_FOUND, options: [...three, option(4, sectionId(4))] })).toBe(false);
  });

  it('rejects ranks out of order and two options with the same sections', () => {
    expect(
      accepts({ ...OPTIONS_FOUND, options: [option(2, sectionId(1)), option(1, sectionId(2))] }),
    ).toBe(false);
    expect(
      accepts({ ...OPTIONS_FOUND, options: [option(1, sectionId(1)), option(2, sectionId(1))] }),
    ).toBe(false);
  });

  it('ranks a PASS schedule before an UNKNOWN one', () => {
    const passFirst = [option(1, sectionId(1)), option(2, sectionId(2), 'UNKNOWN')];
    const unknownFirst = [option(1, sectionId(1), 'UNKNOWN'), option(2, sectionId(2))];

    expect(accepts({ ...OPTIONS_FOUND, options: passFirst })).toBe(true);
    expect(accepts({ ...OPTIONS_FOUND, options: unknownFirst })).toBe(false);
  });

  it('rejects an option for a course that was not requested', () => {
    const other = 'c0a5e000-0000-4000-8000-000000000999';

    expect(accepts({ ...OPTIONS_FOUND, courseIds: [other] })).toBe(false);
  });
});

describe('ScheduleOptionsResponseSchema evidence and pinning', () => {
  it('rejects a conflict that is not a FAIL, and a conflict set claimed minimal', () => {
    const pass = { kind: 'SCHEDULE_FEASIBILITY', state: 'PASS' };

    expect(
      accepts({
        ...NO_FEASIBLE_PLAN,
        conflictSet: { items: [pass], isMinimal: false, omittedCount: 0 },
      }),
    ).toBe(false);
    expect(
      accepts({
        ...NO_FEASIBLE_PLAN,
        conflictSet: { items: [CONFLICT], isMinimal: true, omittedCount: 0 },
      }),
    ).toBe(false);
  });

  it('rejects an unresolved item that is not an UNKNOWN schedule check', () => {
    expect(accepts({ ...NEEDS_VERIFICATION, unresolved: [CONFLICT] })).toBe(false);
  });

  it('rejects missing, repeated, or free-text limitations', () => {
    expect(accepts({ ...OPTIONS_FOUND, limitations: ['NOT_REGISTERED'] })).toBe(false);
    expect(
      accepts({ ...OPTIONS_FOUND, limitations: [...OPTIONS_FOUND.limitations, 'NOT_REGISTERED'] }),
    ).toBe(false);
    expect(
      accepts({ ...OPTIONS_FOUND, limitations: [...OPTIONS_FOUND.limitations, 'Seats may fill'] }),
    ).toBe(false);
  });

  it('accepts a tenant with no transition table, and rejects an out-of-range cap or bad hash', () => {
    const pinned = (patch: object): unknown => ({
      ...OPTIONS_FOUND,
      pinnedInputs: { ...OPTIONS_FOUND.pinnedInputs, ...patch },
    });

    expect(accepts(pinned({ campusTransitionVersion: null }))).toBe(true);
    expect(accepts(pinned({ solverWorkCap: 0 }))).toBe(false);
    expect(accepts(pinned({ solverWorkCap: 3_000_001 }))).toBe(false);
    expect(accepts(pinned({ constraintHash: `sha256:${'0A'.repeat(32)}` }))).toBe(false);
    expect(accepts(pinned({ constraintHash: 'abc' }))).toBe(false);
  });

  it('rejects catalog display entries for courses the response does not name', () => {
    const course = {
      courseId: 'c0a5e000-0000-4000-8000-000000000999',
      code: 'DEMO-X 999',
      title: null,
      credits: { kind: 'FIXED', creditsHundredths: 300 },
    };

    expect(accepts({ ...OPTIONS_FOUND, courses: [course] })).toBe(false);
  });
});
