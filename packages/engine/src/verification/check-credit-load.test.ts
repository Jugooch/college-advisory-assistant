/**
 * @file Tests for the credit-load check: exact sums, bounds, variable credit, and linked sections.
 */
import { describe, expect, it } from 'vitest';

import type { Course } from '@caa/domain';
import { buildCourse, SYNTHETIC_COURSES } from '@caa/test-kit';

import { CandidateSetInputError, type CourseSelection } from './candidate-set';
import { checkCreditLoad, type CreditLoadBounds } from './check-credit-load';

const { math102, phys201, phys201Lab, ind390 } = SYNTHETIC_COURSES;
/** 12.00 to 18.00 credits under a fictional load policy. */
const FULL_TIME: CreditLoadBounds = {
  minCreditsHundredths: 1200,
  maxCreditsHundredths: 1800,
  sourceRef: 'demo-policy/load/full-time',
};

/**
 * Builds a credit-bearing selection.
 *
 * @param course - The course.
 * @param selectedCreditsHundredths - The chosen credit value, or `null`.
 * @param countsCredits - Whether the selection adds its credits.
 * @returns The selection.
 */
function select(
  course: Course,
  selectedCreditsHundredths: number | null = null,
  countsCredits = true,
): CourseSelection {
  return { course, selectedCreditsHundredths, countsCredits };
}

/**
 * Builds a fixed-credit course with the given credits.
 *
 * @param creditsHundredths - The course's credits.
 * @param seed - Distinguishes courses.
 * @returns The course.
 */
function fixed(creditsHundredths: number, seed: number): Course {
  return buildCourse({ creditsHundredths }, seed);
}

describe('checkCreditLoad totals', () => {
  it('passes an exact sum of fixed and selected variable credits within the bounds', () => {
    const selections = [
      select(math102),
      select(phys201),
      select(ind390, 250),
      select(fixed(300, 1)),
    ];

    expect(checkCreditLoad(selections, { ...FULL_TIME, minCreditsHundredths: 1250 })).toEqual({
      kind: 'CREDIT_LOAD',
      state: 'PASS',
      sourceRef: 'demo-policy/load/full-time',
      evidence: {
        rulesetVersion: null,
        decisiveLeaves: [],
        courseIds: [math102.id, phys201.id, ind390.id, buildCourse({}, 1).id],
        creditLoad: {
          totalCreditsHundredths: 1250,
          minCreditsHundredths: 1250,
          maxCreditsHundredths: 1800,
        },
      },
    });
  });

  it('sums fractional credits exactly in hundredths', () => {
    const selections = [select(fixed(333, 1)), select(fixed(333, 2)), select(fixed(334, 3))];

    const check = checkCreditLoad(selections, { ...FULL_TIME, minCreditsHundredths: 1000 });

    expect(check.evidence?.creditLoad?.totalCreditsHundredths).toBe(1000);
    expect(check.state).toBe('PASS');
  });

  it('passes a total exactly at the maximum', () => {
    const selections = [select(fixed(900, 1)), select(fixed(900, 2))];

    expect(checkCreditLoad(selections, FULL_TIME).state).toBe('PASS');
  });

  it('fails a total one hundredth above the maximum with CREDIT_LIMIT_EXCEEDED', () => {
    const selections = [select(fixed(900, 1)), select(fixed(901, 2))];

    expect(checkCreditLoad(selections, FULL_TIME)).toEqual({
      kind: 'CREDIT_LOAD',
      state: 'FAIL',
      reasonCode: 'CREDIT_LIMIT_EXCEEDED',
      sourceRef: 'demo-policy/load/full-time',
      evidence: {
        rulesetVersion: null,
        decisiveLeaves: [],
        courseIds: [buildCourse({}, 1).id, buildCourse({}, 2).id],
        creditLoad: {
          totalCreditsHundredths: 1801,
          minCreditsHundredths: 1200,
          maxCreditsHundredths: 1800,
        },
      },
    });
  });

  it('passes a total exactly at the minimum', () => {
    const selections = [select(fixed(600, 1)), select(fixed(600, 2))];

    expect(checkCreditLoad(selections, FULL_TIME).state).toBe('PASS');
  });

  it('fails a total one hundredth below the minimum with CREDIT_BELOW_MINIMUM', () => {
    const selections = [select(fixed(600, 1)), select(fixed(599, 2))];

    const check = checkCreditLoad(selections, FULL_TIME);

    expect(check.state).toBe('FAIL');
    expect(check.reasonCode).toBe('CREDIT_BELOW_MINIMUM');
    expect(check.evidence?.creditLoad).toEqual({
      totalCreditsHundredths: 1199,
      minCreditsHundredths: 1200,
      maxCreditsHundredths: 1800,
    });
  });

  it('passes an empty set when the minimum is zero', () => {
    const bounds = { ...FULL_TIME, minCreditsHundredths: 0 };

    expect(checkCreditLoad([], bounds).evidence).toEqual({
      rulesetVersion: null,
      decisiveLeaves: [],
      courseIds: [],
      creditLoad: {
        totalCreditsHundredths: 0,
        minCreditsHundredths: 0,
        maxCreditsHundredths: 1800,
      },
    });
  });
});

describe('checkCreditLoad linked sections', () => {
  it('does not count a lab whose credits the lecture total already includes', () => {
    const selections = [select(phys201), select(phys201Lab, null, false)];
    const bounds = { ...FULL_TIME, minCreditsHundredths: 400, maxCreditsHundredths: 400 };

    const check = checkCreditLoad(selections, bounds);

    expect(check.state).toBe('PASS');
    expect(check.evidence?.creditLoad?.totalCreditsHundredths).toBe(400);
    expect(check.evidence?.courseIds).toEqual([phys201.id, phys201Lab.id]);
  });

  it('counts a lab that awards its own credits', () => {
    const selections = [select(phys201), select(phys201Lab)];
    const bounds = { ...FULL_TIME, minCreditsHundredths: 400, maxCreditsHundredths: 400 };

    const check = checkCreditLoad(selections, bounds);

    expect(check.reasonCode).toBe('CREDIT_LIMIT_EXCEEDED');
    expect(check.evidence?.creditLoad?.totalCreditsHundredths).toBe(500);
  });
});

describe('checkCreditLoad variable credit', () => {
  it('is UNKNOWN naming the variable-credit course when no value is selected (AC18)', () => {
    const selections = [select(math102), select(ind390), select(phys201)];

    expect(checkCreditLoad(selections, FULL_TIME)).toEqual({
      kind: 'CREDIT_LOAD',
      state: 'UNKNOWN',
      reasonCode: 'VARIABLE_CREDIT_UNSELECTED',
      sourceRef: 'demo-policy/load/full-time',
      evidence: {
        rulesetVersion: null,
        decisiveLeaves: [],
        courseIds: [ind390.id],
        creditLoad: null,
      },
    });
  });

  it('stays UNKNOWN even when the fixed credits alone exceed the maximum', () => {
    const selections = [select(fixed(1900, 1)), select(ind390)];

    expect(checkCreditLoad(selections, FULL_TIME).reasonCode).toBe('VARIABLE_CREDIT_UNSELECTED');
  });

  it('ignores an unselected variable-credit section that adds no credits', () => {
    const selections = [select(fixed(1200, 1)), select(ind390, null, false)];

    expect(checkCreditLoad(selections, FULL_TIME).state).toBe('PASS');
  });

  it('counts the selected value at each end of the course range', () => {
    const low = checkCreditLoad([select(fixed(1100, 1)), select(ind390, 100)], FULL_TIME);
    const high = checkCreditLoad([select(fixed(1500, 1)), select(ind390, 300)], FULL_TIME);

    expect(low.evidence?.creditLoad?.totalCreditsHundredths).toBe(1200);
    expect(high.evidence?.creditLoad?.totalCreditsHundredths).toBe(1800);
  });
});

describe('checkCreditLoad input errors', () => {
  it.each([
    ['a fractional minimum', { ...FULL_TIME, minCreditsHundredths: 1200.5 }],
    ['a negative minimum', { ...FULL_TIME, minCreditsHundredths: -1 }],
    ['a non-finite maximum', { ...FULL_TIME, maxCreditsHundredths: Number.POSITIVE_INFINITY }],
    ['a minimum above the maximum', { ...FULL_TIME, minCreditsHundredths: 1801 }],
  ])('rejects %s', (_label, bounds) => {
    expect(() => checkCreditLoad([select(math102)], bounds)).toThrow(
      new CandidateSetInputError('bounds'),
    );
  });

  it('rejects an empty policy reference', () => {
    expect(() => checkCreditLoad([select(math102)], { ...FULL_TIME, sourceRef: '' })).toThrow(
      new CandidateSetInputError('boundsSourceRef'),
    );
  });

  it('rejects a total beyond exact integer arithmetic', () => {
    const selections = [select(fixed(2 ** 52, 1)), select(fixed(2 ** 52, 2))];

    expect(() => checkCreditLoad(selections, FULL_TIME)).toThrow(
      new CandidateSetInputError('totalCredits'),
    );
  });

  it('rejects the same course twice', () => {
    expect(() => checkCreditLoad([select(math102), select(math102)], FULL_TIME)).toThrow(
      new CandidateSetInputError('duplicateCourse'),
    );
  });
});

describe('checkCreditLoad replay', () => {
  it('returns deep-equal results for identical inputs', () => {
    const selections = [select(math102), select(ind390, 200), select(phys201Lab, null, false)];

    const first = checkCreditLoad(selections, FULL_TIME);
    const second = checkCreditLoad(selections, FULL_TIME);

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(second).toEqual(first);
  });
});
