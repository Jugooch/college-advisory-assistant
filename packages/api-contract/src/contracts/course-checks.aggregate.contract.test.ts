/**
 * @file Tests that the course-checks response aggregate follows the check-state precedence.
 */
import { describe, expect, it } from 'vitest';

import { CourseChecksResponseSchema } from './course-checks.contract';

const AGGREGATES = ['BLOCKED', 'NEEDS_VERIFICATION', 'CONDITIONAL', 'VALIDATED'];
const PREREQUISITE_PASS = {
  kind: 'PREREQUISITE',
  state: 'PASS',
  evidence: { rulesetVersion: 'demo-2026.1', decisiveLeaves: [] },
};
const PREREQUISITE_FAIL = { ...PREREQUISITE_PASS, state: 'FAIL', reasonCode: 'MIN_GRADE_NOT_MET' };
const APPLICABILITY_PASS = { kind: 'REQUIREMENT_APPLICABILITY', state: 'PASS' };
const APPLICABILITY_UNKNOWN = {
  kind: 'REQUIREMENT_APPLICABILITY',
  state: 'UNKNOWN',
  reasonCode: 'AUDIT_AMBIGUOUS',
};
const APPLICABILITY_CONDITIONAL = {
  kind: 'REQUIREMENT_APPLICABILITY',
  state: 'CONDITIONAL',
  reasonCode: 'REQUIREMENT_IN_PROGRESS',
};
const BASE = {
  setResults: {
    allocation: [{ kind: 'REQUIREMENT_ALLOCATION', state: 'PASS' }],
    creditLoad: {
      kind: 'CREDIT_LOAD',
      state: 'PASS',
      evidence: {
        rulesetVersion: null,
        decisiveLeaves: [],
        creditLoad: {
          totalCreditsHundredths: 1400,
          minCreditsHundredths: 1200,
          maxCreditsHundredths: 1800,
        },
      },
    },
  },
  pinnedInputs: {
    studentSnapshotId: '3c4d5e6f-0000-4000-8000-000000000001',
    studentRecordEffectiveAt: '2026-09-20T07:30:00.000-05:00',
    auditRecordEffectiveAt: '2026-09-20T07:15:00.000-05:00',
    auditSource: 'demo-audit',
    auditVersion: 'audit_demo_r7',
    rulesetVersion: 'demo-2026.1',
  },
};

/**
 * Lists the aggregates the schema accepts for two courses with the given checks.
 *
 * @param first - Checks of the first course, over a PASS prerequisite and PASS applicability.
 * @param second - Checks of the second course, over no prerequisite and PASS applicability.
 * @returns The accepted aggregates, in precedence order.
 */
const acceptedAggregates = (first: object, second: object): readonly string[] => {
  const courseResults = [
    {
      courseId: '00000000-0000-4000-8000-000000000101',
      prerequisite: PREREQUISITE_PASS,
      applicability: APPLICABILITY_PASS,
      ...first,
    },
    {
      courseId: '00000000-0000-4000-8000-000000000102',
      prerequisite: null,
      applicability: APPLICABILITY_PASS,
      ...second,
    },
  ];
  return AGGREGATES.filter(
    (aggregate) =>
      CourseChecksResponseSchema.safeParse({ ...BASE, courseResults, aggregate }).success,
  );
};

describe('CourseChecksResponseSchema aggregate precedence', () => {
  it('accepts only BLOCKED for a FAIL beside an UNKNOWN, so a FAIL is never CONDITIONAL', () => {
    expect(
      acceptedAggregates(
        { prerequisite: PREREQUISITE_FAIL },
        { applicability: APPLICABILITY_UNKNOWN },
      ),
    ).toEqual(['BLOCKED']);
  });

  it('accepts only NEEDS_VERIFICATION for an UNKNOWN beside a CONDITIONAL', () => {
    expect(
      acceptedAggregates(
        { applicability: APPLICABILITY_UNKNOWN },
        { applicability: APPLICABILITY_CONDITIONAL },
      ),
    ).toEqual(['NEEDS_VERIFICATION']);
  });

  it('accepts only CONDITIONAL for a CONDITIONAL beside PASS checks', () => {
    expect(acceptedAggregates({}, { applicability: APPLICABILITY_CONDITIONAL })).toEqual([
      'CONDITIONAL',
    ]);
  });

  it('accepts only VALIDATED when every check passes, so BLOCKED is rejected', () => {
    expect(acceptedAggregates({}, {})).toEqual(['VALIDATED']);
  });

  it('ignores a null prerequisite, which is no rule rather than a check', () => {
    expect(acceptedAggregates({ prerequisite: null }, { prerequisite: null })).toEqual([
      'VALIDATED',
    ]);
  });
});
