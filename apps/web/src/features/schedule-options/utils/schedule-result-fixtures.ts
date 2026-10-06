/**
 * @file Synthetic schedule-options responses for the results tests.
 * @module @caa/web/features/schedule-options/utils/schedule-result-fixtures
 */
import type { ScheduleOption, ScheduleOptionsResponse } from '@caa/api-contract';
import type { CampusId, CheckResult, CourseId, SectionId } from '@caa/domain';

import { indexCourses } from '@/shared/utils/course-display';

/** Synthetic fixture: phys. */
export const PHYS = 'c0a5e000-0000-4000-8000-000000000301' as CourseId;
/** Synthetic fixture: lab. */
export const LAB = 'c0a5e000-0000-4000-8000-000000003010' as CourseId;
/** Synthetic fixture: section id. */
export const SECTION_ID = '5ec71010-0000-4000-8000-000000000001' as SectionId;
/** Synthetic fixture: lab section id. */
export const LAB_SECTION_ID = '5ec71010-0000-4000-8000-000000000011' as SectionId;
/** Synthetic fixture: north. */
export const NORTH = 'c4a1b2c3-0000-4000-8000-000000000001' as CampusId;
/** Synthetic fixture: pinned ruleset. */
export const PINNED_RULESET = 'demo-2026.1';

/** Synthetic fixture: banned. */
export const BANNED = /registered|enrolled|approved/i;

/** Synthetic fixture: courses. */
export const COURSES = indexCourses([
  {
    courseId: PHYS,
    code: 'PHYS 301',
    title: 'Mechanics',
    credits: { kind: 'FIXED', creditsHundredths: 400 },
  },
  {
    courseId: LAB,
    code: 'PHYS 301L',
    title: 'Mechanics Lab',
    credits: { kind: 'FIXED', creditsHundredths: 0 },
  },
]);

/** Synthetic fixture: pass schedule:. */
export const PASS_SCHEDULE: CheckResult = { kind: 'SCHEDULE_FEASIBILITY', state: 'PASS' };

/** Synthetic fixture: load:. */
export const LOAD: CheckResult = {
  kind: 'CREDIT_LOAD',
  state: 'PASS',
  evidence: {
    rulesetVersion: PINNED_RULESET,
    decisiveLeaves: [],
    creditLoad: {
      totalCreditsHundredths: 400,
      minCreditsHundredths: 0,
      maxCreditsHundredths: 1800,
    },
  },
};

/** Synthetic fixture: meeting. */
export const MEETING = {
  weekdays: ['MONDAY', 'WEDNESDAY'],
  startTime: '09:00',
  endTime: '09:50',
  startsOn: '2026-08-24',
  endsOn: '2026-12-11',
  excludedDates: [],
  location: { kind: 'ON_CAMPUS', campusId: NORTH, room: 'SCI 204' },
} as const;

/**
 * Builds one option that passes every check, with fields overridden.
 *
 * @param fields - Fields to override.
 * @returns The option.
 */
export function buildOption(fields: Partial<ScheduleOption> = {}): ScheduleOption {
  return {
    rank: 1,
    bundles: [
      {
        courseId: PHYS,
        creditsCountedHundredths: 400,
        sections: [
          {
            sectionId: SECTION_ID,
            courseId: PHYS,
            sectionCode: '001',
            modality: 'IN_PERSON',
            campusId: NORTH,
            startsOn: '2026-08-24',
            endsOn: '2026-12-11',
            meetings: [MEETING],
            countsCredits: true,
          },
          {
            sectionId: LAB_SECTION_ID,
            courseId: LAB,
            sectionCode: 'L01',
            modality: 'IN_PERSON',
            campusId: NORTH,
            startsOn: '2026-08-24',
            endsOn: '2026-12-11',
            meetings: [
              { ...MEETING, weekdays: null, startTime: null, endTime: null, location: null },
            ],
            countsCredits: false,
          },
        ],
      },
    ],
    scheduleFeasibility: PASS_SCHEDULE,
    courseResults: [
      {
        courseId: PHYS,
        prerequisite: null,
        applicability: { kind: 'REQUIREMENT_APPLICABILITY', state: 'PASS' },
      },
    ],
    linkedCourseResults: [],
    setResults: {
      allocation: [{ kind: 'REQUIREMENT_ALLOCATION', state: 'PASS' }],
      creditLoad: LOAD,
    },
    unmetPreferences: [],
    aggregate: 'VALIDATED',
    ...fields,
  };
}

/** Synthetic fixture: unresolved:. */
export const UNRESOLVED: CheckResult = {
  kind: 'SCHEDULE_FEASIBILITY',
  state: 'UNKNOWN',
  reasonCode: 'SECTION_DATA_MISSING',
  evidence: {
    rulesetVersion: null,
    decisiveLeaves: [],
    scheduleIssues: [{ reasonCode: 'SECTION_DATA_MISSING', courseId: PHYS }],
  },
};

/**
 * Builds an options-found response, with fields overridden.
 *
 * @param fields - Fields to override.
 * @returns The response.
 */
export function buildResult(
  fields: Partial<ScheduleOptionsResponse> = {},
): ScheduleOptionsResponse {
  return {
    outcome: 'OPTIONS_FOUND',
    searchComplete: true,
    courseIds: [PHYS],
    options: [buildOption()],
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
      rulesetVersion: PINNED_RULESET,
      sectionSnapshotId: '5a7b0000-0000-4000-8000-000000000001',
      campusTransitionVersion: PINNED_RULESET,
      solverWorkCap: 3_000_000,
      constraintHash: `sha256:${'0a'.repeat(32)}`,
    },
    courses: [],
    ...fields,
  } as ScheduleOptionsResponse;
}

/** Synthetic fixture: conflict:. */
export const CONFLICT: CheckResult = {
  kind: 'SCHEDULE_FEASIBILITY',
  state: 'FAIL',
  reasonCode: 'MEETING_CONFLICT',
};
