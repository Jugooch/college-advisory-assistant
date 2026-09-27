/**
 * @file Tests for comparing a recorded grade with a required minimum grade.
 */
import { describe, expect, it } from 'vitest';

import type { AcademicPolicy, AcademicPolicyInput, LetterGrade } from '@caa/domain';
import { buildAcademicPolicy, buildGrade, fail, letter, pass } from '@caa/test-kit';

import { compareToMinimumGrade } from './compare-to-minimum-grade';

/** A partial order, so `D+` and `D-` are unranked; the test-kit default ranks every letter. */
const PARTIAL_ORDER: readonly LetterGrade[] = [
  'A',
  'A-',
  'B+',
  'B',
  'B-',
  'C+',
  'C',
  'C-',
  'D',
  'F',
];

// NOTE: a local wrapper only to apply PARTIAL_ORDER by default; everything else is the builder's.
function buildPolicy(overrides: Partial<AcademicPolicyInput> = {}): AcademicPolicy {
  return buildAcademicPolicy({ letterGradeOrder: PARTIAL_ORDER, ...overrides });
}

/** A partial order that ranks `D-` but not `C+`, for the passing-cutoff cases. */
const CUTOFF_ORDER: readonly LetterGrade[] = ['A', 'B', 'C', 'D', 'D-', 'F'];

const PASSED = { state: 'PASS' };
const NOT_MET = { state: 'FAIL', reasonCode: 'MIN_GRADE_NOT_MET' };
const SCHEME_MISMATCH = { state: 'UNKNOWN', reasonCode: 'GRADE_SCHEME_MISMATCH' };
const NOT_RANKED = { state: 'UNKNOWN', reasonCode: 'GRADE_NOT_RANKED' };
const PASS_EQUIVALENCE_UNDEFINED = { state: 'UNKNOWN', reasonCode: 'PASS_EQUIVALENCE_UNDEFINED' };
const PASSING_GRADE_UNDEFINED = { state: 'UNKNOWN', reasonCode: 'PASSING_GRADE_UNDEFINED' };

const PASS_GRADE = pass();
const FAIL_GRADE = fail();

describe('compareToMinimumGrade', () => {
  it('returns PASS when the letter ranks above the minimum', () => {
    expect(compareToMinimumGrade(letter('B'), letter('C'), buildPolicy())).toEqual(PASSED);
  });

  it('returns PASS when the letter equals the minimum', () => {
    expect(compareToMinimumGrade(letter('C'), letter('C'), buildPolicy())).toEqual(PASSED);
  });

  it('returns FAIL when a D is earned against a C minimum', () => {
    expect(compareToMinimumGrade(letter('D'), letter('C'), buildPolicy())).toEqual(NOT_MET);
  });

  it('returns UNKNOWN when the grade letter is missing from the policy order', () => {
    expect(compareToMinimumGrade(letter('D+'), letter('C'), buildPolicy())).toEqual(NOT_RANKED);
  });

  it('returns UNKNOWN when the minimum letter is missing from the policy order', () => {
    expect(compareToMinimumGrade(letter('A'), letter('D-'), buildPolicy())).toEqual(NOT_RANKED);
  });

  it('returns FAIL for a letter that meets the minimum but is below the passing cutoff', () => {
    const policy = buildPolicy({ letterGradeOrder: CUTOFF_ORDER, lowestPassingLetterGrade: 'D' });

    expect(compareToMinimumGrade(letter('D-'), letter('D-'), policy)).toEqual(NOT_MET);
  });

  it('returns PASS for a letter that meets both the minimum and the passing cutoff', () => {
    const policy = buildPolicy({ letterGradeOrder: CUTOFF_ORDER, lowestPassingLetterGrade: 'D' });

    expect(compareToMinimumGrade(letter('C'), letter('D-'), policy)).toEqual(PASSED);
  });

  it('returns FAIL for a letter below both the minimum and the passing cutoff', () => {
    const policy = buildPolicy({ letterGradeOrder: CUTOFF_ORDER, lowestPassingLetterGrade: 'D' });

    expect(compareToMinimumGrade(letter('D-'), letter('C'), policy)).toEqual(NOT_MET);
  });

  it('lets the minimum alone decide when there is no passing cutoff', () => {
    const policy = buildPolicy({ letterGradeOrder: CUTOFF_ORDER });

    expect(compareToMinimumGrade(letter('D-'), letter('D-'), policy)).toEqual(PASSED);
  });

  it('returns FAIL below the passing cutoff even when the minimum letter is unranked', () => {
    const policy = buildPolicy({ letterGradeOrder: CUTOFF_ORDER, lowestPassingLetterGrade: 'D' });

    expect(compareToMinimumGrade(letter('D-'), letter('C+'), policy)).toEqual(NOT_MET);
  });

  it('returns UNKNOWN above the passing cutoff when the minimum letter is unranked', () => {
    const policy = buildPolicy({ letterGradeOrder: CUTOFF_ORDER, lowestPassingLetterGrade: 'D' });

    expect(compareToMinimumGrade(letter('A'), letter('C+'), policy)).toEqual(NOT_RANKED);
  });

  it('returns UNKNOWN when policy is silent on P against a letter minimum', () => {
    expect(compareToMinimumGrade(PASS_GRADE, letter('C'), buildPolicy())).toEqual(
      PASS_EQUIVALENCE_UNDEFINED,
    );
  });

  it('returns PASS for P against a letter minimum when policy says P satisfies it', () => {
    expect(
      compareToMinimumGrade(
        PASS_GRADE,
        letter('C'),
        buildPolicy({ passSatisfiesMinimumGrade: true }),
      ),
    ).toEqual(PASSED);
  });

  it('returns FAIL for P against a letter minimum when policy says P does not satisfy it', () => {
    expect(
      compareToMinimumGrade(
        PASS_GRADE,
        letter('C'),
        buildPolicy({ passSatisfiesMinimumGrade: false }),
      ),
    ).toEqual(NOT_MET);
  });

  it('returns FAIL for a pass/fail F even when P satisfies the minimum', () => {
    expect(
      compareToMinimumGrade(
        FAIL_GRADE,
        letter('C'),
        buildPolicy({ passSatisfiesMinimumGrade: true }),
      ),
    ).toEqual(NOT_MET);
  });

  it('returns FAIL for a ranked F when there is no minimum and no passing cutoff', () => {
    expect(compareToMinimumGrade(letter('F'), null, buildPolicy())).toEqual(NOT_MET);
  });

  it('returns UNKNOWN for a letter missing from the policy order when there is no minimum', () => {
    const policy = buildPolicy({ lowestPassingLetterGrade: 'D' });

    expect(compareToMinimumGrade(letter('D+'), null, policy)).toEqual(NOT_RANKED);
  });

  it('returns UNKNOWN for an F the policy does not rank rather than guessing FAIL', () => {
    const policy = buildPolicy({ letterGradeOrder: ['A', 'B', 'C', 'D'] });

    expect(compareToMinimumGrade(letter('F'), null, policy)).toEqual(NOT_RANKED);
  });

  it('returns PASS for a letter at the lowest passing letter when there is no minimum', () => {
    const policy = buildPolicy({ lowestPassingLetterGrade: 'D' });

    expect(compareToMinimumGrade(letter('D'), null, policy)).toEqual(PASSED);
  });

  it('returns FAIL for a letter below the lowest passing letter when there is no minimum', () => {
    const policy = buildPolicy({ lowestPassingLetterGrade: 'C' });

    expect(compareToMinimumGrade(letter('D'), null, policy)).toEqual(NOT_MET);
  });

  it('returns UNKNOWN for a ranked D when policy does not say which letters pass', () => {
    expect(compareToMinimumGrade(letter('D'), null, buildPolicy())).toEqual(
      PASSING_GRADE_UNDEFINED,
    );
  });

  it('returns PASS for P when there is no minimum', () => {
    expect(compareToMinimumGrade(PASS_GRADE, null, buildPolicy())).toEqual(PASSED);
  });

  it('returns UNKNOWN for a numeric grade against a letter minimum', () => {
    const numeric = buildGrade({ scheme: 'NUMERIC', value: '87.5' });

    expect(compareToMinimumGrade(numeric, letter('C'), buildPolicy())).toEqual(SCHEME_MISMATCH);
  });

  it('returns UNKNOWN for a grade under an unrecognized scheme', () => {
    const unrecognized = buildGrade({ scheme: 'UNKNOWN', value: 'S' });

    expect(compareToMinimumGrade(unrecognized, letter('C'), buildPolicy())).toEqual(
      SCHEME_MISMATCH,
    );
  });

  it('returns UNKNOWN for a numeric grade when there is no minimum', () => {
    const numeric = buildGrade({ scheme: 'NUMERIC', value: '42' });

    expect(compareToMinimumGrade(numeric, null, buildPolicy())).toEqual(SCHEME_MISMATCH);
  });

  it('returns PASS for P against a P minimum', () => {
    expect(compareToMinimumGrade(PASS_GRADE, PASS_GRADE, buildPolicy())).toEqual(PASSED);
  });

  it('returns UNKNOWN for a letter against a P minimum', () => {
    expect(compareToMinimumGrade(letter('A'), PASS_GRADE, buildPolicy())).toEqual(SCHEME_MISMATCH);
  });

  it('returns UNKNOWN against a pass/fail F minimum', () => {
    expect(compareToMinimumGrade(PASS_GRADE, FAIL_GRADE, buildPolicy())).toEqual(SCHEME_MISMATCH);
  });

  it('returns UNKNOWN against a numeric minimum', () => {
    const minimum = buildGrade({ scheme: 'NUMERIC', value: '70' });

    expect(compareToMinimumGrade(letter('A'), minimum, buildPolicy())).toEqual(SCHEME_MISMATCH);
  });
});
