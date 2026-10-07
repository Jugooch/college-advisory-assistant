/**
 * @file Tests for a required course that is repeatable for credit: counted attempts all stand.
 */
import { describe, expect, it } from 'vitest';

import type { AcademicPolicyInput, CourseAttempt } from '@caa/domain';
import {
  buildAcademicPolicy,
  buildCourse,
  buildPrerequisiteRule,
  buildTermCalendar,
  completedAttempt,
  course,
  fail,
  incompleteAttempt,
  inProgressAttempt,
  letter,
  pendingTransferAttempt,
  SYNTHETIC_REPEATABLE_COURSES,
  syntheticId,
  transferAwardedAttempt,
} from '@caa/test-kit';

import { evaluatePrerequisite } from './evaluate-prerequisite';

const { ensemble110: ENSEMBLE, topics280: TOPICS } = SYNTHETIC_REPEATABLE_COURSES;
const GROUP_ID = syntheticId('equivalencyGroup', 0x600);
/** Two courses of one group that disagree on whether repeats earn credit. */
const CONFLICTING = [
  buildCourse({ equivalencyGroupId: GROUP_ID, repeatableForCredit: null }, 0x601),
  buildCourse(
    {
      equivalencyGroupId: GROUP_ID,
      repeatableForCredit: { maxAttempts: null, maxCreditsHundredths: null },
    },
    0x602,
  ),
];
/** A 0-credit repeatable recital: passing it earns 0 credits. */
const RECITAL = buildCourse(
  {
    creditsHundredths: 0,
    repeatableForCredit: { maxAttempts: null, maxCreditsHundredths: null },
  },
  0x700,
);
const COURSES = [ENSEMBLE, TOPICS, RECITAL, ...CONFLICTING];
const TERMS = ['2024SP', '2024FA', '2025SP', '2025FA', '2026SP', '2026FA'];

/**
 * Evaluates a one-course rule with a `C` minimum, without a repeat policy by default.
 *
 * @param attempts - The student's attempts.
 * @param policy - Policy switches to override.
 * @param courseId - The required course; DEMO-TOP 280 by default.
 * @returns The check's state and reason code.
 */
function checkOf(
  attempts: readonly CourseAttempt[],
  policy: Partial<AcademicPolicyInput> = {},
  courseId: string = TOPICS.id,
): unknown {
  const check = evaluatePrerequisite(
    buildPrerequisiteRule({ expression: course(courseId, letter('C')) }),
    { attempts, courses: COURSES },
    {
      academicPolicy: buildAcademicPolicy(policy),
      termCalendar: buildTermCalendar(TERMS.map((termCode) => ({ termCode }))),
    },
  );
  return { state: check.state, reasonCode: check.reasonCode };
}

/**
 * Builds a completed attempt of DEMO-TOP 280.
 *
 * @param grade - The letter grade.
 * @param termCode - The attempt's term.
 * @param seed - The attempt's seed.
 * @returns The attempt, earning 3.00 credits.
 */
function topics(grade: 'A' | 'B' | 'C' | 'D', termCode: string, seed: number): CourseAttempt {
  return completedAttempt({ courseId: TOPICS.id, grade: letter(grade), termCode }, seed);
}

/**
 * Builds completed DEMO-ENS 110 attempts graded `D`, one per term.
 *
 * @param count - How many attempts.
 * @returns The attempts, 1.00 credit each.
 */
function ensembleDs(count: number): CourseAttempt[] {
  return TERMS.slice(0, count).map((termCode, index) =>
    completedAttempt(
      { courseId: ENSEMBLE.id, grade: letter('D'), termCode, creditsEarnedHundredths: 100 },
      index + 1,
    ),
  );
}

const CURRENT = inProgressAttempt({ courseId: TOPICS.id }, 10);
const PENDING = pendingTransferAttempt({ courseId: TOPICS.id }, 11);
const PERMITTED = { allowsInProgressPrerequisites: true };

describe('evaluatePrerequisite for a course repeatable for credit', () => {
  it('passes when a later counted attempt meets the minimum, without a repeat policy', () => {
    const attempts = [topics('D', '2024SP', 1), topics('B', '2024FA', 2)];

    expect(checkOf(attempts)).toEqual({ state: 'PASS', reasonCode: undefined });
  });

  it('passes when an earlier counted attempt meets the minimum and a later one does not', () => {
    const attempts = [topics('B', '2024SP', 1), topics('D', '2024FA', 2)];

    expect(checkOf(attempts)).toEqual({ state: 'PASS', reasonCode: undefined });
  });

  it('keeps a PASS while other attempts are in progress or pending', () => {
    const attempts = [topics('B', '2024SP', 1), CURRENT, PENDING];

    expect(checkOf(attempts)).toEqual({ state: 'PASS', reasonCode: undefined });
  });

  it('fails with MIN_GRADE_NOT_MET when no counted attempt meets the minimum', () => {
    const attempts = [topics('D', '2024SP', 1), topics('D', '2024FA', 2)];

    expect(checkOf(attempts)).toEqual({ state: 'FAIL', reasonCode: 'MIN_GRADE_NOT_MET' });
  });

  it('fails with NO_QUALIFYING_ATTEMPT when the only attempt earned 0 credits', () => {
    const failed = completedAttempt(
      { courseId: TOPICS.id, grade: fail(), creditsEarnedHundredths: 0 },
      1,
    );

    expect(checkOf([failed])).toEqual({ state: 'FAIL', reasonCode: 'NO_QUALIFYING_ATTEMPT' });
  });

  it('is UNKNOWN when a counted attempt has no recorded grade and none meets the minimum', () => {
    const attempts = [
      topics('D', '2024SP', 1),
      transferAwardedAttempt({ courseId: TOPICS.id, termCode: '2024FA' }, 2),
    ];

    expect(checkOf(attempts)).toEqual({ state: 'UNKNOWN', reasonCode: 'GRADE_NOT_RECORDED' });
  });

  it('is CONDITIONAL on an in-progress attempt when the record fails', () => {
    const attempts = [topics('D', '2024SP', 1), CURRENT];

    expect(checkOf(attempts, PERMITTED)).toEqual({
      state: 'CONDITIONAL',
      reasonCode: 'IN_PROGRESS_MIN_GRADE',
    });
  });

  it('fails with PROGRESSION_NOT_PERMITTED when in-progress work may not be planned on', () => {
    const attempts = [topics('D', '2024SP', 1), CURRENT];

    expect(checkOf(attempts)).toEqual({ state: 'FAIL', reasonCode: 'PROGRESSION_NOT_PERMITTED' });
  });

  it('is UNKNOWN with PENDING_TRANSFER when only a pending transfer could satisfy it', () => {
    const attempts = [topics('D', '2024SP', 1), PENDING];

    expect(checkOf(attempts)).toEqual({ state: 'UNKNOWN', reasonCode: 'PENDING_TRANSFER' });
  });

  it('prefers the pending transfer over in-progress work that may not be planned on', () => {
    const attempts = [topics('D', '2024SP', 1), CURRENT, PENDING];

    expect(checkOf(attempts)).toEqual({ state: 'UNKNOWN', reasonCode: 'PENDING_TRANSFER' });
  });

  it('is CONDITIONAL with in-progress work and a pending transfer when nothing is capped', () => {
    const attempts = [topics('D', '2024SP', 1), CURRENT, PENDING];

    expect(checkOf(attempts, PERMITTED)).toEqual({
      state: 'CONDITIONAL',
      reasonCode: 'IN_PROGRESS_MIN_GRADE',
    });
  });

  it('is UNKNOWN when several attempts are in progress', () => {
    const attempts = [CURRENT, inProgressAttempt({ courseId: TOPICS.id }, 12)];

    expect(checkOf(attempts, PERMITTED)).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
    });
  });

  it('is CONDITIONAL when the in-progress attempt takes the last slot under the attempt cap', () => {
    const attempts = [...ensembleDs(3), inProgressAttempt({ courseId: ENSEMBLE.id }, 10)];

    expect(checkOf(attempts, PERMITTED, ENSEMBLE.id)).toEqual({
      state: 'CONDITIONAL',
      reasonCode: 'IN_PROGRESS_MIN_GRADE',
    });
  });

  it('is UNKNOWN when the attempt cap may leave the in-progress attempt out', () => {
    const attempts = [...ensembleDs(4), inProgressAttempt({ courseId: ENSEMBLE.id }, 10)];

    expect(checkOf(attempts, PERMITTED, ENSEMBLE.id)).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
    });
  });

  it('is UNKNOWN when the attempt cap cut falls on a term missing from the calendar', () => {
    const unplaced = completedAttempt(
      { courseId: ENSEMBLE.id, termCode: '1999XX', creditsEarnedHundredths: 100 },
      9,
    );

    expect(checkOf([...ensembleDs(4), unplaced], {}, ENSEMBLE.id)).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
    });
  });

  it('is UNKNOWN when the courses of the group disagree on repeat credit', () => {
    const attempts = CONFLICTING.map((conflicting, index) =>
      completedAttempt({ courseId: conflicting.id, termCode: '2024SP' }, index + 1),
    );

    expect(checkOf(attempts, {}, syntheticId('course', 0x601))).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'REPEAT_POLICY_UNDEFINED',
    });
  });

  it('is UNKNOWN when an attempt is incomplete, even beside a passing one', () => {
    const attempts = [topics('B', '2024SP', 1), incompleteAttempt({ courseId: TOPICS.id }, 2)];

    expect(checkOf(attempts)).toEqual({ state: 'UNKNOWN', reasonCode: 'INCOMPLETE_ATTEMPT' });
  });

  it('passes on a 0-credit course whose attempt meets the minimum', () => {
    const passed = completedAttempt(
      { courseId: RECITAL.id, grade: letter('A'), creditsEarnedHundredths: 0 },
      1,
    );

    expect(checkOf([passed], {}, RECITAL.id)).toEqual({ state: 'PASS', reasonCode: undefined });
  });

  it('fails on a 0-credit course whose only attempt was failed', () => {
    const failed = completedAttempt(
      { courseId: RECITAL.id, grade: letter('F'), creditsEarnedHundredths: 0 },
      1,
    );

    expect(checkOf([failed], {}, RECITAL.id)).toEqual({
      state: 'FAIL',
      reasonCode: 'NO_QUALIFYING_ATTEMPT',
    });
  });
});
