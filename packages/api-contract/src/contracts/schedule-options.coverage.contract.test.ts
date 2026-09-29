/**
 * @file Tests that every schedule option covers every requested course with exactly one bundle,
 *   and that option prerequisites use the pinned ruleset.
 */
import { describe, expect, it } from 'vitest';

import { ScheduleOptionsResponseSchema } from './schedule-options.contract';

const PHYS_301 = 'c0a5e000-0000-4000-8000-000000000301';
const CHEM_101 = 'c0a5e000-0000-4000-8000-000000000101';
const PASS_APPLICABILITY = { kind: 'REQUIREMENT_APPLICABILITY', state: 'PASS' };

const bundle = (courseId: string, sectionId: string): object => ({
  courseId,
  sections: [
    {
      sectionId,
      courseId,
      sectionCode: '001',
      modality: 'ONLINE_ASYNCHRONOUS',
      campusId: null,
      startsOn: '2026-08-24',
      endsOn: '2026-12-11',
      meetings: [],
      countsCredits: true,
    },
  ],
  creditsCountedHundredths: 300,
});

const PHYS_BUNDLE = bundle(PHYS_301, '5ec71010-0000-4000-8000-000000000001');
const CHEM_BUNDLE = bundle(CHEM_101, '5ec71010-0000-4000-8000-000000000002');

const optionFor = (
  courseIds: readonly string[],
  bundles: readonly object[],
  prerequisite: object | null = null,
): object => ({
  rank: 1,
  bundles,
  scheduleFeasibility: { kind: 'SCHEDULE_FEASIBILITY', state: 'PASS' },
  courseResults: courseIds.map((courseId) => ({
    courseId,
    prerequisite,
    applicability: PASS_APPLICABILITY,
  })),
  setResults: {
    allocation: [{ kind: 'REQUIREMENT_ALLOCATION', state: 'PASS' }],
    creditLoad: {
      kind: 'CREDIT_LOAD',
      state: 'PASS',
      evidence: {
        rulesetVersion: 'demo-2026.1',
        decisiveLeaves: [],
        creditLoad: {
          totalCreditsHundredths: 600,
          minCreditsHundredths: 0,
          maxCreditsHundredths: 1800,
        },
      },
    },
  },
  unmetPreferences: [],
  aggregate: 'VALIDATED',
});

const response = (option: object): unknown => ({
  outcome: 'OPTIONS_FOUND',
  searchComplete: true,
  courseIds: [PHYS_301, CHEM_101],
  options: [option],
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
});

const COVERAGE_MESSAGE = 'Every option must schedule every requested course, one bundle each';

describe('ScheduleOptionsResponseSchema requested-course coverage', () => {
  it('accepts an option that schedules both requested courses', () => {
    const both = optionFor([PHYS_301, CHEM_101], [PHYS_BUNDLE, CHEM_BUNDLE]);

    expect(ScheduleOptionsResponseSchema.safeParse(response(both)).success).toBe(true);
  });

  it('rejects an option that drops a requested course, and with it that course’s checks', () => {
    const dropped = optionFor([PHYS_301], [PHYS_BUNDLE]);
    const result = ScheduleOptionsResponseSchema.safeParse(response(dropped));

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([COVERAGE_MESSAGE]);
  });

  it('rejects an option that drops a course even when its other bundle is unrequested', () => {
    const other = 'c0a5e000-0000-4000-8000-000000000999';
    const swapped = optionFor(
      [PHYS_301, other],
      [PHYS_BUNDLE, bundle(other, '5ec71010-0000-4000-8000-000000000003')],
    );
    const result = ScheduleOptionsResponseSchema.safeParse(response(swapped));

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([COVERAGE_MESSAGE]);
  });
});

describe('ScheduleOptionsResponseSchema ruleset pinning', () => {
  const prerequisiteUnder = (rulesetVersion: string): object => ({
    kind: 'PREREQUISITE',
    state: 'PASS',
    sourceRef: 'demo-rules:PHYS-301',
    evidence: { rulesetVersion, decisiveLeaves: [] },
  });
  const BOTH = [PHYS_301, CHEM_101];
  const BUNDLES = [PHYS_BUNDLE, CHEM_BUNDLE];

  it('accepts option prerequisites evaluated under the pinned ruleset', () => {
    const pinned = optionFor(BOTH, BUNDLES, prerequisiteUnder('demo-2026.1'));

    expect(ScheduleOptionsResponseSchema.safeParse(response(pinned)).success).toBe(true);
  });

  it('rejects an option prerequisite evaluated under another ruleset', () => {
    const stale = optionFor(BOTH, BUNDLES, prerequisiteUnder('demo-2025.9'));
    const result = ScheduleOptionsResponseSchema.safeParse(response(stale));

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Prerequisite evidence must use the pinned rulesetVersion',
    ]);
  });
});
