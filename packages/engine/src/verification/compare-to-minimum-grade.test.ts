/**
 * @file Tests for comparing a recorded grade with a required minimum grade.
 */
import { describe, expect, it } from 'vitest';

import {
  type AcademicPolicy,
  createAcademicPolicy,
  createGrade,
  type Grade,
  type LetterGrade,
} from '@caa/domain';

import { compareToMinimumGrade } from './compare-to-minimum-grade';

// NOTE: @caa/test-kit has no builders for grades or policies yet (#53), so these use the
// domain factories directly.
function buildPolicy(passSatisfiesMinimumGrade: boolean | null = null): AcademicPolicy {
  return createAcademicPolicy({
    tenantId: '00000000-0000-4000-8000-000000000001',
    rulesetVersion: 'demo-2026.1',
    allowsInProgressPrerequisites: true,
    passSatisfiesMinimumGrade,
    letterGradeOrder: ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'],
    repeatPolicy: null,
  });
}

function letter(value: LetterGrade): Grade {
  return createGrade({ scheme: 'LETTER', value });
}

const PASS_GRADE = createGrade({ scheme: 'PASS_FAIL', value: 'P' });
const FAIL_GRADE = createGrade({ scheme: 'PASS_FAIL', value: 'F' });

describe('compareToMinimumGrade', () => {
  it('returns PASS when the letter ranks above the minimum', () => {
    expect(compareToMinimumGrade(letter('B'), letter('C'), buildPolicy())).toEqual({
      state: 'PASS',
    });
  });

  it('returns PASS when the letter equals the minimum', () => {
    expect(compareToMinimumGrade(letter('C'), letter('C'), buildPolicy())).toEqual({
      state: 'PASS',
    });
  });

  it('returns FAIL when a D is earned against a C minimum', () => {
    expect(compareToMinimumGrade(letter('D'), letter('C'), buildPolicy())).toEqual({
      state: 'FAIL',
      reasonCode: 'MIN_GRADE_NOT_MET',
    });
  });

  it('returns UNKNOWN when the grade letter is missing from the policy order', () => {
    expect(compareToMinimumGrade(letter('D+'), letter('C'), buildPolicy())).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'GRADE_NOT_RANKED',
    });
  });

  it('returns UNKNOWN when the minimum letter is missing from the policy order', () => {
    expect(compareToMinimumGrade(letter('A'), letter('D-'), buildPolicy())).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'GRADE_NOT_RANKED',
    });
  });

  it('returns UNKNOWN when policy is silent on P against a letter minimum', () => {
    expect(compareToMinimumGrade(PASS_GRADE, letter('C'), buildPolicy(null))).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'PASS_EQUIVALENCE_UNDEFINED',
    });
  });

  it('returns PASS for P against a letter minimum when policy says P satisfies it', () => {
    expect(compareToMinimumGrade(PASS_GRADE, letter('C'), buildPolicy(true))).toEqual({
      state: 'PASS',
    });
  });

  it('returns FAIL for P against a letter minimum when policy says P does not satisfy it', () => {
    expect(compareToMinimumGrade(PASS_GRADE, letter('C'), buildPolicy(false))).toEqual({
      state: 'FAIL',
      reasonCode: 'MIN_GRADE_NOT_MET',
    });
  });

  it('returns FAIL for a pass/fail F even when P satisfies the minimum', () => {
    expect(compareToMinimumGrade(FAIL_GRADE, letter('C'), buildPolicy(true))).toEqual({
      state: 'FAIL',
      reasonCode: 'MIN_GRADE_NOT_MET',
    });
  });

  it('returns FAIL for a letter F when there is no minimum', () => {
    expect(compareToMinimumGrade(letter('F'), null, buildPolicy())).toEqual({
      state: 'FAIL',
      reasonCode: 'MIN_GRADE_NOT_MET',
    });
  });

  it('returns PASS for a passing letter when there is no minimum', () => {
    expect(compareToMinimumGrade(letter('D'), null, buildPolicy())).toEqual({ state: 'PASS' });
  });

  it('returns PASS for P when there is no minimum', () => {
    expect(compareToMinimumGrade(PASS_GRADE, null, buildPolicy(null))).toEqual({ state: 'PASS' });
  });

  it('returns UNKNOWN for a numeric grade against a letter minimum', () => {
    const numeric = createGrade({ scheme: 'NUMERIC', value: '87.5' });

    expect(compareToMinimumGrade(numeric, letter('C'), buildPolicy())).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'GRADE_SCHEME_MISMATCH',
    });
  });

  it('returns UNKNOWN for a grade under an unrecognized scheme', () => {
    const unrecognized = createGrade({ scheme: 'UNKNOWN', value: 'S' });

    expect(compareToMinimumGrade(unrecognized, letter('C'), buildPolicy())).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'GRADE_SCHEME_MISMATCH',
    });
  });

  it('returns UNKNOWN for a numeric grade when there is no minimum', () => {
    const numeric = createGrade({ scheme: 'NUMERIC', value: '42' });

    expect(compareToMinimumGrade(numeric, null, buildPolicy())).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'GRADE_SCHEME_MISMATCH',
    });
  });

  it('returns PASS for P against a P minimum', () => {
    expect(compareToMinimumGrade(PASS_GRADE, PASS_GRADE, buildPolicy())).toEqual({
      state: 'PASS',
    });
  });

  it('returns UNKNOWN for a letter against a P minimum', () => {
    expect(compareToMinimumGrade(letter('A'), PASS_GRADE, buildPolicy())).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'GRADE_SCHEME_MISMATCH',
    });
  });

  it('returns UNKNOWN against a pass/fail F minimum', () => {
    expect(compareToMinimumGrade(PASS_GRADE, FAIL_GRADE, buildPolicy())).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'GRADE_SCHEME_MISMATCH',
    });
  });

  it('returns UNKNOWN against a numeric minimum', () => {
    const minimum = createGrade({ scheme: 'NUMERIC', value: '70' });

    expect(compareToMinimumGrade(letter('A'), minimum, buildPolicy())).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'GRADE_SCHEME_MISMATCH',
    });
  });
});
