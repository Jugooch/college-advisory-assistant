/**
 * @file Tests that a schedule option's aggregate follows its academic checks as well as its schedule.
 */
import { describe, expect, it } from 'vitest';

import { ScheduleOptionSchema } from './schedule-option.contract';

const PHYS_301 = 'c0a5e000-0000-4000-8000-000000000301';
const PASS_APPLICABILITY = { kind: 'REQUIREMENT_APPLICABILITY', state: 'PASS' };
const PREREQUISITE_EVIDENCE = { rulesetVersion: 'demo-2026.1', decisiveLeaves: [] };

const optionWith = (prerequisite: object, aggregate: string): unknown => ({
  rank: 1,
  bundles: [
    {
      courseId: PHYS_301,
      sections: [
        {
          sectionId: '5ec71010-0000-4000-8000-000000000001',
          courseId: PHYS_301,
          sectionCode: '001',
          modality: 'ONLINE_ASYNCHRONOUS',
          campusId: null,
          startsOn: '2026-08-24',
          endsOn: '2026-12-11',
          meetings: [],
          countsCredits: true,
        },
      ],
      creditsCountedHundredths: 400,
    },
  ],
  scheduleFeasibility: { kind: 'SCHEDULE_FEASIBILITY', state: 'PASS' },
  courseResults: [{ courseId: PHYS_301, prerequisite, applicability: PASS_APPLICABILITY }],
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
  aggregate,
});

const CONDITIONAL_PREREQUISITE = {
  kind: 'PREREQUISITE',
  state: 'CONDITIONAL',
  reasonCode: 'IN_PROGRESS_MIN_GRADE',
  evidence: PREREQUISITE_EVIDENCE,
};

const FAILED_PREREQUISITE = {
  kind: 'PREREQUISITE',
  state: 'FAIL',
  reasonCode: 'MIN_GRADE_NOT_MET',
  evidence: PREREQUISITE_EVIDENCE,
};

const accepts = (payload: unknown): boolean => ScheduleOptionSchema.safeParse(payload).success;

describe('ScheduleOptionSchema aggregate with academic checks', () => {
  it('accepts a CONDITIONAL prerequisite with a PASS schedule only as CONDITIONAL', () => {
    expect(accepts(optionWith(CONDITIONAL_PREREQUISITE, 'CONDITIONAL'))).toBe(true);
    expect(accepts(optionWith(CONDITIONAL_PREREQUISITE, 'VALIDATED'))).toBe(false);
  });

  it('keeps an option whose prerequisite FAILs, as BLOCKED and never VALIDATED (ADR-0010 §2)', () => {
    expect(accepts(optionWith(FAILED_PREREQUISITE, 'BLOCKED'))).toBe(true);

    const result = ScheduleOptionSchema.safeParse(optionWith(FAILED_PREREQUISITE, 'VALIDATED'));

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'aggregate must follow the FAIL, UNKNOWN, CONDITIONAL, PASS precedence',
    ]);
  });
});
