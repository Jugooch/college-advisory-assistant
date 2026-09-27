/**
 * @file Tests for choosing which repeated attempt counts under a repeat policy.
 */
import { describe, expect, it } from 'vitest';

import {
  type AttemptStatus,
  type CourseAttempt,
  createAcademicPolicy,
  createCourseAttempt,
  type GradeInput,
  type RepeatPolicy,
} from '@caa/domain';

import { type AttemptResolutionContext, selectCountingAttempt } from './select-counting-attempt';

// NOTE: @caa/test-kit has no builders for attempts or policies yet (#53), so these use the
// domain factories directly.
interface AttemptOverrides {
  readonly id: string;
  readonly termCode?: string;
  readonly status?: AttemptStatus;
  readonly grade?: GradeInput | null;
  readonly creditsEarnedHundredths?: number | null;
}

function buildAttempt(overrides: AttemptOverrides): CourseAttempt {
  return createCourseAttempt({
    id: overrides.id,
    tenantId: '00000000-0000-4000-8000-000000000001',
    studentId: '00000000-0000-4000-8000-000000000002',
    courseId: '00000000-0000-4000-8000-000000000003',
    sourceAttemptId: `demo-${overrides.id.slice(-2)}`,
    termCode: overrides.termCode ?? '2025FA',
    status: overrides.status ?? 'COMPLETED',
    grade: overrides.grade === undefined ? { scheme: 'LETTER', value: 'B' } : overrides.grade,
    creditsEarnedHundredths:
      overrides.creditsEarnedHundredths === undefined ? 300 : overrides.creditsEarnedHundredths,
  });
}

function buildContext(repeatPolicy: RepeatPolicy | null): AttemptResolutionContext {
  return {
    academicPolicy: createAcademicPolicy({
      tenantId: '00000000-0000-4000-8000-000000000001',
      rulesetVersion: 'demo-2026.1',
      allowsInProgressPrerequisites: true,
      passSatisfiesMinimumGrade: null,
      letterGradeOrder: ['A', 'B', 'C', 'D', 'F'],
      repeatPolicy,
    }),
    termCodesOldestFirst: ['2025SP', '2025FA', '2026SP'],
  };
}

const UNSET = buildContext(null);
const MOST_RECENT = buildContext('MOST_RECENT');
const HIGHEST_GRADE = buildContext('HIGHEST_GRADE');

const FIRST_ID = '00000000-0000-4000-8000-000000000011';
const SECOND_ID = '00000000-0000-4000-8000-000000000012';

describe('selectCountingAttempt', () => {
  it('returns NONE with zero earned credits when nothing was completed', () => {
    expect(selectCountingAttempt([], UNSET)).toEqual({
      state: 'NONE',
      earnedCreditsHundredths: 0,
    });
  });

  it('counts a single completed attempt even when the policy has no repeat policy', () => {
    const attempt = buildAttempt({ id: FIRST_ID, creditsEarnedHundredths: 350 });

    expect(selectCountingAttempt([attempt], UNSET)).toEqual({
      state: 'COUNTED',
      attempt,
      earnedCreditsHundredths: 350,
    });
  });

  it('keeps earned credits unknown when the counting attempt has no recorded award', () => {
    const attempt = buildAttempt({ id: FIRST_ID, creditsEarnedHundredths: null });

    expect(selectCountingAttempt([attempt], UNSET)).toEqual({
      state: 'COUNTED',
      attempt,
      earnedCreditsHundredths: null,
    });
  });

  it('returns UNDETERMINED for a repeat when the policy has no repeat policy', () => {
    const attempts = [buildAttempt({ id: FIRST_ID }), buildAttempt({ id: SECOND_ID })];

    expect(selectCountingAttempt(attempts, UNSET)).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_POLICY_UNDEFINED',
      earnedCreditsHundredths: null,
    });
  });

  it('counts the attempt in the latest term under MOST_RECENT, whatever its position', () => {
    const later = buildAttempt({ id: FIRST_ID, termCode: '2026SP', grade: null });
    const earlier = buildAttempt({ id: SECOND_ID, termCode: '2025SP' });

    expect(selectCountingAttempt([later, earlier], MOST_RECENT)).toEqual({
      state: 'COUNTED',
      attempt: later,
      earnedCreditsHundredths: 300,
    });
  });

  it('returns UNDETERMINED under MOST_RECENT when a term is missing from the order', () => {
    const attempts = [
      buildAttempt({ id: FIRST_ID, termCode: '2025FA' }),
      buildAttempt({ id: SECOND_ID, termCode: '2027SU' }),
    ];

    expect(selectCountingAttempt(attempts, MOST_RECENT)).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
      earnedCreditsHundredths: null,
    });
  });

  it('returns UNDETERMINED under MOST_RECENT when both attempts share the latest term', () => {
    const attempts = [
      buildAttempt({ id: FIRST_ID, termCode: '2026SP' }),
      buildAttempt({ id: SECOND_ID, termCode: '2026SP' }),
    ];

    expect(selectCountingAttempt(attempts, MOST_RECENT)).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
      earnedCreditsHundredths: null,
    });
  });

  it('counts the higher letter under HIGHEST_GRADE, whatever its term', () => {
    const lower = buildAttempt({
      id: FIRST_ID,
      termCode: '2026SP',
      grade: { scheme: 'LETTER', value: 'D' },
    });
    const higher = buildAttempt({
      id: SECOND_ID,
      termCode: '2025SP',
      grade: { scheme: 'LETTER', value: 'B' },
    });

    expect(selectCountingAttempt([lower, higher], HIGHEST_GRADE)).toEqual({
      state: 'COUNTED',
      attempt: higher,
      earnedCreditsHundredths: 300,
    });
  });

  it('counts P over F under HIGHEST_GRADE', () => {
    const passed = buildAttempt({ id: FIRST_ID, grade: { scheme: 'PASS_FAIL', value: 'P' } });
    const failed = buildAttempt({
      id: SECOND_ID,
      grade: { scheme: 'PASS_FAIL', value: 'F' },
      creditsEarnedHundredths: 0,
    });

    expect(selectCountingAttempt([passed, failed], HIGHEST_GRADE)).toEqual({
      state: 'COUNTED',
      attempt: passed,
      earnedCreditsHundredths: 300,
    });
  });

  it('returns UNDETERMINED under HIGHEST_GRADE when a letter is missing from the order', () => {
    const attempts = [
      buildAttempt({ id: FIRST_ID, grade: { scheme: 'LETTER', value: 'B+' } }),
      buildAttempt({ id: SECOND_ID, grade: { scheme: 'LETTER', value: 'C' } }),
    ];

    expect(selectCountingAttempt(attempts, HIGHEST_GRADE)).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
      earnedCreditsHundredths: null,
    });
  });

  it('returns UNDETERMINED under HIGHEST_GRADE when the grades use different schemes', () => {
    const attempts = [
      buildAttempt({ id: FIRST_ID, grade: { scheme: 'PASS_FAIL', value: 'P' } }),
      buildAttempt({ id: SECOND_ID, grade: { scheme: 'LETTER', value: 'B' } }),
    ];

    expect(selectCountingAttempt(attempts, HIGHEST_GRADE)).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
      earnedCreditsHundredths: null,
    });
  });

  it('returns UNDETERMINED under HIGHEST_GRADE when the best grade is tied', () => {
    const attempts = [buildAttempt({ id: FIRST_ID }), buildAttempt({ id: SECOND_ID })];

    expect(selectCountingAttempt(attempts, HIGHEST_GRADE)).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
      earnedCreditsHundredths: null,
    });
  });

  it('returns UNDETERMINED under HIGHEST_GRADE when no grades were recorded', () => {
    const attempts = [
      buildAttempt({ id: FIRST_ID, grade: null }),
      buildAttempt({ id: SECOND_ID, grade: null }),
    ];

    expect(selectCountingAttempt(attempts, HIGHEST_GRADE)).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
      earnedCreditsHundredths: null,
    });
  });

  it('returns UNDETERMINED under HIGHEST_GRADE for numeric grades', () => {
    const attempts = [
      buildAttempt({ id: FIRST_ID, grade: { scheme: 'NUMERIC', value: '91' } }),
      buildAttempt({ id: SECOND_ID, grade: { scheme: 'NUMERIC', value: '64' } }),
    ];

    expect(selectCountingAttempt(attempts, HIGHEST_GRADE)).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
      earnedCreditsHundredths: null,
    });
  });
});
