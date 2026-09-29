/**
 * @file Tests for one schedule option: bundles, checks, unmet preferences, and aggregate.
 */
import { describe, expect, it } from 'vitest';

import { ScheduleOptionSchema, SectionBundleSchema } from './schedule-option.contract';

const PHYS_301 = 'c0a5e000-0000-4000-8000-000000000301';
const PHYS_301L = 'c0a5e000-0000-4000-8000-000000003010';
const NORTH_CAMPUS_ID = 'c4a1b2c3-0000-4000-8000-000000000001';

const MEETING = {
  weekdays: ['MONDAY', 'WEDNESDAY'],
  startTime: '09:00',
  endTime: '09:50',
  startsOn: '2026-08-24',
  endsOn: '2026-12-11',
  excludedDates: [],
  location: { kind: 'ON_CAMPUS', campusId: NORTH_CAMPUS_ID, room: null },
};

const LECTURE = {
  sectionId: '5ec71010-0000-4000-8000-000000000001',
  courseId: PHYS_301,
  sectionCode: '001',
  modality: 'IN_PERSON',
  campusId: NORTH_CAMPUS_ID,
  startsOn: '2026-08-24',
  endsOn: '2026-12-11',
  meetings: [MEETING],
  countsCredits: true,
};

const LAB = {
  ...LECTURE,
  sectionId: '5ec71010-0000-4000-8000-000000000011',
  courseId: PHYS_301L,
  sectionCode: 'L01',
  meetings: [{ ...MEETING, weekdays: ['THURSDAY'], startTime: '14:00', endTime: '16:50' }],
  countsCredits: false,
};

const BUNDLE = { courseId: PHYS_301, sections: [LECTURE, LAB], creditsCountedHundredths: 400 };

const LOAD_PASS = {
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
};

const OPTION = {
  rank: 1,
  bundles: [BUNDLE],
  scheduleFeasibility: { kind: 'SCHEDULE_FEASIBILITY', state: 'PASS' },
  courseResults: [
    {
      courseId: PHYS_301,
      prerequisite: null,
      applicability: { kind: 'REQUIREMENT_APPLICABILITY', state: 'PASS' },
    },
  ],
  setResults: {
    allocation: [{ kind: 'REQUIREMENT_ALLOCATION', state: 'PASS' }],
    creditLoad: LOAD_PASS,
  },
  unmetPreferences: [],
  aggregate: 'VALIDATED',
};

// TODO(#212): use MEETING_TIME_UNKNOWN once the schedule reason codes land.
const SCHEDULE_UNKNOWN = {
  kind: 'SCHEDULE_FEASIBILITY',
  state: 'UNKNOWN',
  reasonCode: 'COURSE_NOT_IN_CATALOG',
};

const accepts = (payload: unknown): boolean => ScheduleOptionSchema.safeParse(payload).success;

describe('SectionBundleSchema', () => {
  it('accepts a lecture with its linked lab from another course, counting only the lecture', () => {
    expect(SectionBundleSchema.parse(BUNDLE)).toEqual(BUNDLE);
  });

  it('accepts an unknown credit count', () => {
    expect(
      SectionBundleSchema.safeParse({ ...BUNDLE, creditsCountedHundredths: null }).success,
    ).toBe(true);
  });

  it('rejects a bundle whose first section is not the requested course', () => {
    expect(SectionBundleSchema.safeParse({ ...BUNDLE, sections: [LAB, LECTURE] }).success).toBe(
      false,
    );
  });

  it('rejects a repeated section or an empty bundle', () => {
    expect(SectionBundleSchema.safeParse({ ...BUNDLE, sections: [LECTURE, LECTURE] }).success).toBe(
      false,
    );
    expect(SectionBundleSchema.safeParse({ ...BUNDLE, sections: [] }).success).toBe(false);
  });
});

describe('ScheduleOptionSchema', () => {
  it('accepts a validated option', () => {
    expect(ScheduleOptionSchema.parse(OPTION)).toEqual(OPTION);
  });

  it('accepts an UNKNOWN schedule with a NEEDS_VERIFICATION aggregate', () => {
    expect(
      accepts({
        ...OPTION,
        scheduleFeasibility: SCHEDULE_UNKNOWN,
        aggregate: 'NEEDS_VERIFICATION',
      }),
    ).toBe(true);
  });

  it('rejects an UNKNOWN schedule shown as VALIDATED', () => {
    expect(accepts({ ...OPTION, scheduleFeasibility: SCHEDULE_UNKNOWN })).toBe(false);
  });

  it('rejects a FAIL schedule, because a candidate that breaks a hard rule is not an option', () => {
    const fail = {
      kind: 'SCHEDULE_FEASIBILITY',
      state: 'FAIL',
      reasonCode: 'CREDIT_LIMIT_EXCEEDED',
    };

    expect(accepts({ ...OPTION, scheduleFeasibility: fail, aggregate: 'BLOCKED' })).toBe(false);
  });

  it('rejects a CONDITIONAL schedule, which no schedule check produces', () => {
    const conditional = {
      kind: 'SCHEDULE_FEASIBILITY',
      state: 'CONDITIONAL',
      reasonCode: 'IN_PROGRESS_MIN_GRADE',
    };
    const result = ScheduleOptionSchema.safeParse({
      ...OPTION,
      scheduleFeasibility: conditional,
      aggregate: 'CONDITIONAL',
    });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'scheduleFeasibility must be PASS or UNKNOWN',
    ]);
  });

  it('rejects a FAIL credit load, because the credit range is a hard rule too', () => {
    const overLoad = {
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
    const result = ScheduleOptionSchema.safeParse({
      ...OPTION,
      setResults: { ...OPTION.setResults, creditLoad: overLoad },
      aggregate: 'BLOCKED',
    });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'An option never has a FAIL creditLoad',
    ]);
  });

  it('accepts an UNKNOWN credit load with a NEEDS_VERIFICATION aggregate', () => {
    const unknownLoad = {
      kind: 'CREDIT_LOAD',
      state: 'UNKNOWN',
      reasonCode: 'VARIABLE_CREDIT_UNSELECTED',
    };

    expect(
      accepts({
        ...OPTION,
        setResults: { ...OPTION.setResults, creditLoad: unknownLoad },
        aggregate: 'NEEDS_VERIFICATION',
      }),
    ).toBe(true);
  });

  it('rejects a schedule check of another kind', () => {
    expect(
      accepts({ ...OPTION, scheduleFeasibility: { kind: 'CREDIT_LOAD', state: 'PASS' } }),
    ).toBe(false);
  });

  it('accepts an unmet preference on a section of the option', () => {
    const unmet = {
      constraintIndex: 0,
      priorityRank: 1,
      kind: 'UNAVAILABLE_TIME',
      sectionId: LAB.sectionId,
      meetingIndex: 0,
      isDataUnknown: false,
    };

    expect(accepts({ ...OPTION, unmetPreferences: [unmet] })).toBe(true);
    expect(
      accepts({
        ...OPTION,
        unmetPreferences: [{ ...unmet, sectionId: '5ec71010-0000-4000-8000-000000000099' }],
      }),
    ).toBe(false);
  });

  it('rejects a bundle and course results that name different courses', () => {
    const otherCourse = { ...OPTION.courseResults[0], courseId: PHYS_301L };

    expect(accepts({ ...OPTION, courseResults: [otherCourse] })).toBe(false);
  });

  it('rejects two bundles for one course', () => {
    expect(accepts({ ...OPTION, bundles: [BUNDLE, BUNDLE] })).toBe(false);
  });

  it('rejects one section in two bundles', () => {
    const labCourse = { ...OPTION.courseResults[0], courseId: PHYS_301L };
    const result = ScheduleOptionSchema.safeParse({
      ...OPTION,
      bundles: [
        { courseId: PHYS_301, sections: [LECTURE, LAB], creditsCountedHundredths: 400 },
        { courseId: PHYS_301L, sections: [LAB], creditsCountedHundredths: 0 },
      ],
      courseResults: [...OPTION.courseResults, labCourse],
    });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'A section may appear in only one bundle',
    ]);
  });

  it('rejects a rank outside 1 to 3', () => {
    expect(accepts({ ...OPTION, rank: 0 })).toBe(false);
    expect(accepts({ ...OPTION, rank: 4 })).toBe(false);
  });
});
