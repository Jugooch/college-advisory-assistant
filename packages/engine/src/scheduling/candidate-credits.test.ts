/**
 * @file Tests for judging a candidate's credit load against the policy and the student's ranges.
 */
import { describe, expect, it } from 'vitest';

import {
  buildAcademicPolicy,
  buildCourse,
  buildCreditRange,
  buildVariableCreditCourse,
  HARD_STRENGTH,
} from '@caa/test-kit';

import type { CourseSelection } from '../verification/candidate-set';
import {
  boundsOf,
  creditLoadCheckOf,
  creditsByCourse,
  creditVerdictOf,
  missesPreferredRange,
} from './candidate-credits';
import { ScheduleInputError } from './schedule-input-error';

const POLICY = buildAcademicPolicy({
  termCreditBounds: { minCreditsHundredths: 1200, maxCreditsHundredths: 1800 },
});
const NO_BOUNDS = buildAcademicPolicy();
const HARD_RANGE = buildCreditRange({
  ...HARD_STRENGTH,
  minCreditsHundredths: null,
  maxCreditsHundredths: 1500,
});

describe('creditsByCourse', () => {
  it('reads credits, chosen values and the including course by position', () => {
    const lecture = buildCourse({}, 1);
    const lab = buildCourse({ creditsHundredths: 100, creditsIncludedInCourseId: lecture.id }, 2);
    const variable = buildVariableCreditCourse({}, 3);
    const elsewhere = buildCourse({ creditsIncludedInCourseId: buildCourse({}, 9).id }, 4);

    expect(creditsByCourse([lecture, lab, variable, elsewhere], new Map())).toEqual([
      { courseId: lecture.id, credits: 300, includer: -1 },
      { courseId: lab.id, credits: 100, includer: 0 },
      { courseId: variable.id, credits: null, includer: -1 },
      { courseId: elsewhere.id, credits: 300, includer: -1 },
    ]);
  });
});

describe('boundsOf', () => {
  it('narrows the hard range to the policy and fills its open side', () => {
    expect(boundsOf(POLICY, [HARD_RANGE, buildCreditRange()])).toEqual({
      policyBounds: { minCreditsHundredths: 1200, maxCreditsHundredths: 1800 },
      studentBounds: {
        constraintIndex: 0,
        bounds: { minCreditsHundredths: 1200, maxCreditsHundredths: 1500 },
      },
      preferredBounds: { minCreditsHundredths: 1200, maxCreditsHundredths: 1500 },
    });
  });

  it('fills an open preferred maximum with no limit', () => {
    const open = buildCreditRange({ minCreditsHundredths: 900, maxCreditsHundredths: null });

    expect(boundsOf(POLICY, [open]).preferredBounds).toEqual({
      minCreditsHundredths: 900,
      maxCreditsHundredths: Number.MAX_SAFE_INTEGER,
    });
  });

  it('keeps the hard range without policy bounds, filling its open side with no limit', () => {
    expect(boundsOf(NO_BOUNDS, [HARD_RANGE])).toEqual({
      policyBounds: null,
      studentBounds: {
        constraintIndex: 0,
        bounds: { minCreditsHundredths: 0, maxCreditsHundredths: 1500 },
      },
      preferredBounds: null,
    });
  });

  it('refuses a hard range that admits no load within the policy', () => {
    const tooHigh = buildCreditRange({
      ...HARD_STRENGTH,
      minCreditsHundredths: 2000,
      maxCreditsHundredths: null,
    });

    expect(() => boundsOf(POLICY, [tooHigh])).toThrow(new ScheduleInputError('creditRange'));
  });
});

describe('creditVerdictOf and missesPreferredRange', () => {
  const withRange = boundsOf(POLICY, [
    HARD_RANGE,
    buildCreditRange({ minCreditsHundredths: 1300 }),
  ]);

  it('is UNKNOWN for an unknown total or missing policy bounds, never PASS', () => {
    expect(creditVerdictOf(withRange, null).state).toBe('UNKNOWN');
    expect(creditVerdictOf(boundsOf(NO_BOUNDS, []), 1200).state).toBe('UNKNOWN');
  });

  it('fails the policy first, then the hard range, and passes inside both', () => {
    expect(creditVerdictOf(withRange, 900)).toEqual({
      state: 'FAIL',
      reasonCode: 'CREDIT_BELOW_MINIMUM',
    });
    expect(creditVerdictOf(withRange, 1600)).toEqual({
      state: 'FAIL',
      reasonCode: 'CREDIT_LIMIT_EXCEEDED',
    });
    expect(creditVerdictOf(withRange, 1500)).toEqual({ state: 'PASS', reasonCode: null });
    expect(creditVerdictOf(boundsOf(POLICY, []), 1700).state).toBe('PASS');
  });

  it('fails a known total over the hard range without policy bounds, else is UNKNOWN', () => {
    const noPolicy = boundsOf(NO_BOUNDS, [HARD_RANGE]);

    expect(creditVerdictOf(noPolicy, 1600)).toEqual({
      state: 'FAIL',
      reasonCode: 'CREDIT_LIMIT_EXCEEDED',
    });
    expect(creditVerdictOf(noPolicy, 1500)).toEqual({ state: 'UNKNOWN', reasonCode: null });
    expect(creditVerdictOf(noPolicy, null)).toEqual({ state: 'UNKNOWN', reasonCode: null });
  });

  it('misses the preferred range when outside it or unknown', () => {
    expect(missesPreferredRange(withRange, 1200)).toBe(true);
    expect(missesPreferredRange(withRange, null)).toBe(true);
    expect(missesPreferredRange(withRange, 1400)).toBe(false);
    expect(missesPreferredRange(boundsOf(POLICY, []), null)).toBe(false);
  });
});

describe('creditLoadCheckOf', () => {
  /**
   * Builds selections of fixed-credit courses.
   *
   * @param credits - Each course's credits in hundredths.
   * @returns The selections.
   */
  function selectionsOf(credits: readonly number[]): CourseSelection[] {
    return credits.map((creditsHundredths, index) => ({
      course: buildCourse({ creditsHundredths }, index + 1),
      selectedCreditsHundredths: null,
      countsCredits: true,
    }));
  }
  const model = boundsOf(POLICY, [buildCreditRange(), HARD_RANGE]);

  it("returns the policy's check when it doesn't pass", () => {
    expect(creditLoadCheckOf(selectionsOf([300]), POLICY, model)).toMatchObject({
      state: 'FAIL',
      reasonCode: 'CREDIT_BELOW_MINIMUM',
      sourceRef: 'demo-2026.1:termCreditBounds',
    });
  });

  it("returns the policy's PASS when the hard range passes too", () => {
    expect(creditLoadCheckOf(selectionsOf([600, 700]), POLICY, model)).toMatchObject({
      state: 'PASS',
      sourceRef: 'demo-2026.1:termCreditBounds',
    });
  });

  it('names the hard range when only it fails', () => {
    expect(creditLoadCheckOf(selectionsOf([800, 800]), POLICY, model)).toMatchObject({
      state: 'FAIL',
      reasonCode: 'CREDIT_LIMIT_EXCEEDED',
      sourceRef: 'demo-2026.1:constraints[1]',
      evidence: { creditLoad: { totalCreditsHundredths: 1600, maxCreditsHundredths: 1500 } },
    });
  });

  it('fails a known total over the hard range when the policy has no bounds', () => {
    const noPolicy = boundsOf(NO_BOUNDS, [buildCreditRange(), HARD_RANGE]);

    expect(creditLoadCheckOf(selectionsOf([800, 800]), NO_BOUNDS, noPolicy)).toMatchObject({
      state: 'FAIL',
      reasonCode: 'CREDIT_LIMIT_EXCEEDED',
      sourceRef: 'demo-2026.1:constraints[1]',
      evidence: { creditLoad: { totalCreditsHundredths: 1600, maxCreditsHundredths: 1500 } },
    });
    expect(creditLoadCheckOf(selectionsOf([600, 700]), NO_BOUNDS, noPolicy)).toMatchObject({
      state: 'UNKNOWN',
      reasonCode: 'CREDIT_BOUNDS_UNDEFINED',
    });
  });

  it("returns the policy's check when the student set no hard range", () => {
    expect(creditLoadCheckOf(selectionsOf([600, 700]), POLICY, boundsOf(POLICY, [])).state).toBe(
      'PASS',
    );
  });
});
