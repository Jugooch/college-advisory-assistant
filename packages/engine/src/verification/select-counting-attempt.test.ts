/**
 * @file Tests for choosing which repeated attempt counts under a repeat policy.
 */
import { describe, expect, it } from 'vitest';

import type { RepeatPolicy } from '@caa/domain';
import {
  buildAcademicPolicy,
  buildGrade,
  completedAttempt,
  fail,
  letter,
  pass,
} from '@caa/test-kit';

import { type AttemptResolutionContext, selectCountingAttempt } from './select-counting-attempt';

// NOTE: the resolution context is an engine type, so test-kit has no builder for it. The partial
// letter order leaves `B+` unranked; the test-kit default ranks every letter.
function buildContext(repeatPolicy: RepeatPolicy | null): AttemptResolutionContext {
  return {
    academicPolicy: buildAcademicPolicy({
      letterGradeOrder: ['A', 'B', 'C', 'D', 'F'],
      repeatPolicy,
    }),
    termCodesOldestFirst: ['2025SP', '2025FA', '2026SP'],
  };
}

const UNSET = buildContext(null);
const MOST_RECENT = buildContext('MOST_RECENT');
const HIGHEST_GRADE = buildContext('HIGHEST_GRADE');

describe('selectCountingAttempt', () => {
  it('returns NONE with zero earned credits when nothing was completed', () => {
    expect(selectCountingAttempt([], UNSET)).toEqual({
      state: 'NONE',
      earnedCreditsHundredths: 0,
    });
  });

  it('counts a single completed attempt even when the policy has no repeat policy', () => {
    const attempt = completedAttempt({ creditsEarnedHundredths: 350 });

    expect(selectCountingAttempt([attempt], UNSET)).toEqual({
      state: 'COUNTED',
      attempt,
      earnedCreditsHundredths: 350,
    });
  });

  it('keeps earned credits unknown when the counting attempt has no recorded award', () => {
    const attempt = completedAttempt({ creditsEarnedHundredths: null });

    expect(selectCountingAttempt([attempt], UNSET)).toEqual({
      state: 'COUNTED',
      attempt,
      earnedCreditsHundredths: null,
    });
  });

  it('returns UNDETERMINED for a repeat when the policy has no repeat policy', () => {
    const attempts = [completedAttempt({}, 1), completedAttempt({}, 2)];

    expect(selectCountingAttempt(attempts, UNSET)).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_POLICY_UNDEFINED',
      earnedCreditsHundredths: null,
    });
  });

  it('counts the attempt in the latest term under MOST_RECENT, whatever its position', () => {
    const later = completedAttempt({ termCode: '2026SP', grade: null }, 1);
    const earlier = completedAttempt({ termCode: '2025SP' }, 2);

    expect(selectCountingAttempt([later, earlier], MOST_RECENT)).toEqual({
      state: 'COUNTED',
      attempt: later,
      earnedCreditsHundredths: 300,
    });
  });

  it('returns UNDETERMINED under MOST_RECENT when a term is missing from the order', () => {
    const attempts = [
      completedAttempt({ termCode: '2025FA' }, 1),
      completedAttempt({ termCode: '2027SU' }, 2),
    ];

    expect(selectCountingAttempt(attempts, MOST_RECENT)).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
      earnedCreditsHundredths: null,
    });
  });

  it('returns UNDETERMINED under MOST_RECENT when both attempts share the latest term', () => {
    const attempts = [
      completedAttempt({ termCode: '2026SP' }, 1),
      completedAttempt({ termCode: '2026SP' }, 2),
    ];

    expect(selectCountingAttempt(attempts, MOST_RECENT)).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
      earnedCreditsHundredths: null,
    });
  });

  it('counts the higher letter under HIGHEST_GRADE, whatever its term', () => {
    const lower = completedAttempt({ termCode: '2026SP', grade: letter('D') }, 1);
    const higher = completedAttempt({ termCode: '2025SP', grade: letter('B') }, 2);

    expect(selectCountingAttempt([lower, higher], HIGHEST_GRADE)).toEqual({
      state: 'COUNTED',
      attempt: higher,
      earnedCreditsHundredths: 300,
    });
  });

  it('counts P over F under HIGHEST_GRADE', () => {
    const passed = completedAttempt({ grade: pass() }, 1);
    const failed = completedAttempt({ grade: fail(), creditsEarnedHundredths: 0 }, 2);

    expect(selectCountingAttempt([passed, failed], HIGHEST_GRADE)).toEqual({
      state: 'COUNTED',
      attempt: passed,
      earnedCreditsHundredths: 300,
    });
  });

  it('returns UNDETERMINED under HIGHEST_GRADE when a letter is missing from the order', () => {
    const attempts = [
      completedAttempt({ grade: letter('B+') }, 1),
      completedAttempt({ grade: letter('C') }, 2),
    ];

    expect(selectCountingAttempt(attempts, HIGHEST_GRADE)).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
      earnedCreditsHundredths: null,
    });
  });

  it('returns UNDETERMINED under HIGHEST_GRADE when the grades use different schemes', () => {
    const attempts = [
      completedAttempt({ grade: pass() }, 1),
      completedAttempt({ grade: letter('B') }, 2),
    ];

    expect(selectCountingAttempt(attempts, HIGHEST_GRADE)).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
      earnedCreditsHundredths: null,
    });
  });

  it('returns UNDETERMINED under HIGHEST_GRADE when the best grade is tied', () => {
    const attempts = [completedAttempt({}, 1), completedAttempt({}, 2)];

    expect(selectCountingAttempt(attempts, HIGHEST_GRADE)).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
      earnedCreditsHundredths: null,
    });
  });

  it('returns UNDETERMINED under HIGHEST_GRADE when no grades were recorded', () => {
    const attempts = [completedAttempt({ grade: null }, 1), completedAttempt({ grade: null }, 2)];

    expect(selectCountingAttempt(attempts, HIGHEST_GRADE)).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
      earnedCreditsHundredths: null,
    });
  });

  it('returns UNDETERMINED under HIGHEST_GRADE for numeric grades', () => {
    const attempts = [
      completedAttempt({ grade: buildGrade({ scheme: 'NUMERIC', value: '91' }) }, 1),
      completedAttempt({ grade: buildGrade({ scheme: 'NUMERIC', value: '64' }) }, 2),
    ];

    expect(selectCountingAttempt(attempts, HIGHEST_GRADE)).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
      earnedCreditsHundredths: null,
    });
  });
});
