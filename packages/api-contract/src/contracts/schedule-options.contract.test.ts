/**
 * @file Tests for the schedule-options endpoint and response: each outcome and its evidence.
 */
import { describe, expect, it } from 'vitest';

import {
  buildOption,
  buildResponse,
  CREDIT_CONFLICT,
  LIMITATIONS,
  MISSING_SECTIONS,
  PHYS_301,
  PINNED_INPUTS,
  singleSectionBundle,
  singleSectionOption,
  UNKNOWN_SCHEDULE,
} from '../testing/schedule-option-fixtures';
import {
  findScheduleOptionsEndpoint,
  ScheduleOptionsResponseSchema,
} from './schedule-options.contract';

const OPTIONS_FOUND = buildResponse({
  options: [singleSectionOption(1, 1), singleSectionOption(2, 2)],
});
const CONFLICT_SET = { items: [CREDIT_CONFLICT], isMinimal: false, omittedCount: 0 };
const NO_FEASIBLE_PLAN = buildResponse({
  outcome: 'NO_FEASIBLE_PLAN',
  options: [],
  conflictSet: CONFLICT_SET,
});
const SEARCH_TIMEOUT = buildResponse({
  outcome: 'SEARCH_TIMEOUT',
  searchComplete: false,
  options: [],
});
const NEEDS_VERIFICATION = {
  ...SEARCH_TIMEOUT,
  outcome: 'NEEDS_VERIFICATION',
  unresolved: [MISSING_SECTIONS],
};

const accepts = (payload: unknown): boolean =>
  ScheduleOptionsResponseSchema.safeParse(payload).success;
const messages = (payload: unknown): readonly string[] =>
  ScheduleOptionsResponseSchema.safeParse(payload).error?.issues.map((issue) => issue.message) ??
  [];

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
    ['OPTIONS_FOUND with a conflict set', { ...OPTIONS_FOUND, conflictSet: CONFLICT_SET }],
    ['NO_FEASIBLE_PLAN with no conflict set', { ...NO_FEASIBLE_PLAN, conflictSet: null }],
    ['NO_FEASIBLE_PLAN from an incomplete search', { ...NO_FEASIBLE_PLAN, searchComplete: false }],
    [
      'NO_FEASIBLE_PLAN with an option',
      { ...NO_FEASIBLE_PLAN, options: [singleSectionOption(1, 1)] },
    ],
    ['SEARCH_TIMEOUT from a complete search', { ...SEARCH_TIMEOUT, searchComplete: true }],
    ['SEARCH_TIMEOUT with a conflict set', { ...SEARCH_TIMEOUT, conflictSet: CONFLICT_SET }],
    ['NEEDS_VERIFICATION with nothing unresolved', { ...NEEDS_VERIFICATION, unresolved: [] }],
    ['SEARCH_TIMEOUT with unresolved data', { ...SEARCH_TIMEOUT, unresolved: [MISSING_SECTIONS] }],
  ])('rejects %s', (_name, payload) => {
    expect(accepts(payload)).toBe(false);
  });

  it('rejects a repeated requested course even when there are no options', () => {
    expect(messages({ ...SEARCH_TIMEOUT, courseIds: [PHYS_301, PHYS_301] })).toEqual([
      'courseIds must not repeat a course',
    ]);
  });

  it('rejects an unresolved item that is not an UNKNOWN schedule check', () => {
    expect(accepts({ ...NEEDS_VERIFICATION, unresolved: [CREDIT_CONFLICT] })).toBe(false);
  });

  it('rejects an unresolved schedule unknown that is not about missing sections', () => {
    expect(messages({ ...NEEDS_VERIFICATION, unresolved: [UNKNOWN_SCHEDULE] })).toEqual([
      'An unresolved item is an UNKNOWN SCHEDULE_FEASIBILITY check for missing sections',
    ]);
  });
});

describe('ScheduleOptionsResponseSchema options', () => {
  it('accepts three options and rejects four', () => {
    const three = [1, 2, 3].map((rank) => singleSectionOption(rank, rank));

    expect(accepts({ ...OPTIONS_FOUND, options: three })).toBe(true);
    expect(accepts({ ...OPTIONS_FOUND, options: [...three, singleSectionOption(4, 4)] })).toBe(
      false,
    );
  });

  it('rejects ranks out of order and two options with the same sections', () => {
    expect(
      accepts({
        ...OPTIONS_FOUND,
        options: [singleSectionOption(2, 1), singleSectionOption(1, 2)],
      }),
    ).toBe(false);
    expect(
      accepts({
        ...OPTIONS_FOUND,
        options: [singleSectionOption(1, 1), singleSectionOption(2, 1)],
      }),
    ).toBe(false);
  });

  it('ranks a PASS schedule before an UNKNOWN one', () => {
    const passFirst = [singleSectionOption(1, 1), singleSectionOption(2, 2, true)];
    const unknownFirst = [singleSectionOption(1, 1, true), singleSectionOption(2, 2)];

    expect(accepts({ ...OPTIONS_FOUND, options: passFirst })).toBe(true);
    expect(accepts({ ...OPTIONS_FOUND, options: unknownFirst })).toBe(false);
  });

  it('rejects options that show one course with different academic checks (ADR-0010 §2)', () => {
    const failing = {
      kind: 'REQUIREMENT_APPLICABILITY',
      state: 'FAIL',
      reasonCode: 'NOT_APPLICABLE',
    };
    const blocked = buildOption({
      rank: 2,
      bundles: [singleSectionBundle(2)],
      applicability: failing,
      aggregate: 'BLOCKED',
    });

    expect(messages({ ...OPTIONS_FOUND, options: [singleSectionOption(1, 1), blocked] })).toEqual([
      'Every option must carry the same courseResults and allocation',
    ]);
  });
});

describe('ScheduleOptionsResponseSchema limitations and pinning', () => {
  it('rejects missing, repeated, or free-text limitations', () => {
    for (const limitations of [
      ['NOT_REGISTERED'],
      [...LIMITATIONS, 'NOT_REGISTERED'],
      [...LIMITATIONS, 'Seats may fill'],
    ]) {
      expect(accepts({ ...OPTIONS_FOUND, limitations })).toBe(false);
    }
  });

  it('accepts a tenant with no transition table, and rejects an out-of-range cap or bad hash', () => {
    const pinned = (patch: object): unknown => ({
      ...OPTIONS_FOUND,
      pinnedInputs: { ...PINNED_INPUTS, ...patch },
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
