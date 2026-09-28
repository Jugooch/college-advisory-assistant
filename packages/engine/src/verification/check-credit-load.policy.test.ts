/**
 * @file Tests for the credit-load check read from the academic policy's term credit bounds.
 */
import { describe, expect, it } from 'vitest';

import type { AcademicPolicy, Course } from '@caa/domain';
import { buildAcademicPolicy, SYNTHETIC_COURSES } from '@caa/test-kit';

import { CandidateSetInputError, type CourseSelection } from './candidate-set';
import { checkCreditLoad } from './check-credit-load';

const { math102, phys201, ind390 } = SYNTHETIC_COURSES;
/** Ruleset `demo-2026.1` with 6.00 to 7.00 credits a term. */
const BOUNDED = buildAcademicPolicy({
  termCreditBounds: { minCreditsHundredths: 600, maxCreditsHundredths: 700 },
});
/** Ruleset `demo-2026.1` with no credit bounds supplied. */
const UNBOUNDED = buildAcademicPolicy({ termCreditBounds: null });

/**
 * Builds a credit-bearing selection.
 *
 * @param course - The course.
 * @param selectedCreditsHundredths - The chosen credit value, or `null`.
 * @returns The selection.
 */
function select(course: Course, selectedCreditsHundredths: number | null = null): CourseSelection {
  return { course, selectedCreditsHundredths, countsCredits: true };
}

describe('checkCreditLoad with a policy that has no credit bounds', () => {
  it('is UNKNOWN CREDIT_BOUNDS_UNDEFINED with a null creditLoad, never a default load', () => {
    expect(checkCreditLoad([select(math102), select(phys201)], UNBOUNDED)).toEqual({
      kind: 'CREDIT_LOAD',
      state: 'UNKNOWN',
      reasonCode: 'CREDIT_BOUNDS_UNDEFINED',
      sourceRef: 'demo-2026.1:termCreditBounds',
      evidence: {
        rulesetVersion: 'demo-2026.1',
        decisiveLeaves: [],
        courseIds: [math102.id, phys201.id],
        creditLoad: null,
      },
    });
  });

  it('reports the missing bounds before an unchosen variable credit, naming every course', () => {
    const check = checkCreditLoad([select(math102), select(ind390)], UNBOUNDED);

    expect([check.reasonCode, check.evidence?.courseIds]).toEqual([
      'CREDIT_BOUNDS_UNDEFINED',
      [math102.id, ind390.id],
    ]);
  });

  it('is UNKNOWN CREDIT_BOUNDS_UNDEFINED for an empty set', () => {
    expect(checkCreditLoad([], UNBOUNDED).state).toBe('UNKNOWN');
  });

  it('still rejects a malformed candidate set', () => {
    expect(() => checkCreditLoad([select(math102), select(math102)], UNBOUNDED)).toThrow(
      new CandidateSetInputError('duplicateCourse'),
    );
  });
});

describe('checkCreditLoad with the policy credit bounds', () => {
  it('passes a total within the bounds, naming the ruleset and the bounds', () => {
    expect(checkCreditLoad([select(math102), select(phys201)], BOUNDED)).toEqual({
      kind: 'CREDIT_LOAD',
      state: 'PASS',
      sourceRef: 'demo-2026.1:termCreditBounds',
      evidence: {
        rulesetVersion: 'demo-2026.1',
        decisiveLeaves: [],
        courseIds: [math102.id, phys201.id],
        creditLoad: {
          totalCreditsHundredths: 700,
          minCreditsHundredths: 600,
          maxCreditsHundredths: 700,
        },
      },
    });
  });

  it('fails a total above the maximum with CREDIT_LIMIT_EXCEEDED', () => {
    const check = checkCreditLoad([select(math102), select(phys201), select(ind390, 100)], BOUNDED);

    expect([check.state, check.reasonCode, check.evidence?.creditLoad]).toEqual([
      'FAIL',
      'CREDIT_LIMIT_EXCEEDED',
      { totalCreditsHundredths: 800, minCreditsHundredths: 600, maxCreditsHundredths: 700 },
    ]);
  });

  it('fails a total below the minimum with CREDIT_BELOW_MINIMUM', () => {
    const check = checkCreditLoad([select(math102)], BOUNDED);

    expect([check.state, check.reasonCode, check.evidence?.creditLoad]).toEqual([
      'FAIL',
      'CREDIT_BELOW_MINIMUM',
      { totalCreditsHundredths: 300, minCreditsHundredths: 600, maxCreditsHundredths: 700 },
    ]);
  });

  it('is UNKNOWN VARIABLE_CREDIT_UNSELECTED when a variable credit is unchosen', () => {
    const check = checkCreditLoad([select(math102), select(ind390)], BOUNDED);

    expect([check.state, check.reasonCode, check.evidence?.courseIds]).toEqual([
      'UNKNOWN',
      'VARIABLE_CREDIT_UNSELECTED',
      [ind390.id],
    ]);
  });

  it('rejects inverted bounds that bypassed the schema instead of using them', () => {
    const inverted: AcademicPolicy = {
      ...BOUNDED,
      termCreditBounds: { minCreditsHundredths: 800, maxCreditsHundredths: 700 },
    };

    expect(() => checkCreditLoad([select(math102)], inverted)).toThrow(
      new CandidateSetInputError('bounds'),
    );
  });
});
