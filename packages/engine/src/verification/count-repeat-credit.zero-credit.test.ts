/**
 * @file Tests for counting repeatable attempts at a course that awards 0 credits.
 */
import { describe, expect, it } from 'vitest';

import type { CourseAttempt, RepeatableForCredit } from '@caa/domain';
import {
  buildAcademicPolicy,
  buildCourse,
  buildTermCalendar,
  completedAttempt,
  fail,
  letter,
  pass,
  SYNTHETIC_COURSES,
  SYNTHETIC_REPEATABLE_COURSES,
} from '@caa/test-kit';

import { countRepeatCredit, type RepeatCreditRules } from './count-repeat-credit';
import type { AttemptResolutionContext } from './select-counting-attempt';

const ENSEMBLE = SYNTHETIC_REPEATABLE_COURSES.ensemble110;
const UNCAPPED: RepeatableForCredit = { maxAttempts: null, maxCreditsHundredths: null };
const TWO_ATTEMPTS: RepeatableForCredit = { maxAttempts: 2, maxCreditsHundredths: null };
/** A 0-credit recital: passing it earns 0 credits. */
const RECITAL = buildCourse({ creditsHundredths: 0, repeatableForCredit: TWO_ATTEMPTS }, 0x700);
const CATALOG = [SYNTHETIC_COURSES.math101, ENSEMBLE, RECITAL];

/**
 * Pairs a statement with the test catalog.
 *
 * @param statement - The group's statement.
 * @returns The counting rules.
 */
function rules(statement: RepeatableForCredit): RepeatCreditRules {
  return { statement, courseById: new Map(CATALOG.map((entry) => [entry.id, entry])) };
}

/**
 * Builds a completed DEMO-GEN recital attempt, which earns 0 credits.
 *
 * @param termCode - The attempt's term.
 * @param seed - The attempt's seed.
 * @param grade - The grade, `P` by default.
 * @returns The attempt.
 */
function recital(termCode: string, seed: number, grade = pass()): CourseAttempt {
  return completedAttempt(
    { courseId: RECITAL.id, termCode, grade, creditsEarnedHundredths: 0 },
    seed,
  );
}

// NOTE: no repeat policy, to show that repeatable counting never consults it.
const CONTEXT: AttemptResolutionContext = {
  academicPolicy: buildAcademicPolicy({ repeatPolicy: null }),
  termCalendar: buildTermCalendar([
    { termCode: '2024SP' },
    { termCode: '2024FA' },
    { termCode: '2025SP' },
    { termCode: '2025FA' },
    { termCode: '2026SP' },
  ]),
};

const ORDER_UNDETERMINED = {
  state: 'UNDETERMINED',
  reasonCode: 'REPEAT_ORDER_UNDETERMINED',
  earnedCreditsHundredths: null,
};

describe('countRepeatCredit for a 0-credit course', () => {
  it('counts a passed attempt at a 0-credit course, earning 0 credits', () => {
    const passed = recital('2024SP', 1);

    expect(countRepeatCredit([passed], rules(TWO_ATTEMPTS), CONTEXT)).toEqual({
      state: 'COUNTED',
      attempts: [passed],
      earnedCreditsHundredths: 0,
    });
  });

  it('lets passed 0-credit attempts use up the attempt cap', () => {
    const first = recital('2024SP', 1);
    const second = recital('2024FA', 2);
    const attempts = [first, second, recital('2025SP', 3)];

    expect(countRepeatCredit(attempts, rules(TWO_ATTEMPTS), CONTEXT)).toEqual({
      state: 'COUNTED',
      attempts: [first, second],
      earnedCreditsHundredths: 0,
    });
    expect(countRepeatCredit([first, second], rules(TWO_ATTEMPTS), CONTEXT)).toEqual({
      state: 'COUNTED',
      attempts: [first, second],
      earnedCreditsHundredths: 0,
    });
  });

  it("doesn't use up the attempt cap with a failed attempt at a 0-credit course", () => {
    const first = recital('2024SP', 1);
    const failed = recital('2024FA', 2, fail());
    const third = recital('2025SP', 3);

    expect(countRepeatCredit([third, failed, first], rules(TWO_ATTEMPTS), CONTEXT)).toEqual({
      state: 'COUNTED',
      attempts: [first, third],
      earnedCreditsHundredths: 0,
    });
    expect(countRepeatCredit([failed], rules(TWO_ATTEMPTS), CONTEXT)).toEqual({
      state: 'NONE',
      earnedCreditsHundredths: 0,
    });
  });

  it('decides a 0-credit letter grade by the policy passing cutoff', () => {
    const attempts = [
      recital('2024SP', 1, letter('B')),
      recital('2024FA', 2),
      recital('2025SP', 3),
    ];
    const [first, second] = attempts;
    const withCutoff = {
      ...CONTEXT,
      academicPolicy: buildAcademicPolicy({ repeatPolicy: null, lowestPassingLetterGrade: 'D' }),
    };

    expect(countRepeatCredit(attempts, rules(TWO_ATTEMPTS), withCutoff)).toEqual({
      state: 'COUNTED',
      attempts: [first, second],
      earnedCreditsHundredths: 0,
    });
  });

  it('is undetermined when a 0-credit attempt that may have failed falls before the cut', () => {
    const unsettledGrade = [
      recital('2024SP', 1, letter('B')),
      recital('2024FA', 2),
      recital('2025SP', 3),
    ];
    const ungraded = [
      completedAttempt(
        { courseId: RECITAL.id, termCode: '2024SP', grade: null, creditsEarnedHundredths: 0 },
        1,
      ),
      recital('2024FA', 2),
      recital('2025SP', 3),
    ];

    expect(countRepeatCredit(unsettledGrade, rules(TWO_ATTEMPTS), CONTEXT)).toEqual(
      ORDER_UNDETERMINED,
    );
    expect(countRepeatCredit(ungraded, rules(TWO_ATTEMPTS), CONTEXT)).toEqual(ORDER_UNDETERMINED);
  });

  it('counts a 0-credit attempt that may have failed when no attempt cap binds', () => {
    const unsettled = recital('2024SP', 1, letter('B'));

    expect(countRepeatCredit([unsettled], rules(UNCAPPED), CONTEXT)).toEqual({
      state: 'COUNTED',
      attempts: [unsettled],
      earnedCreditsHundredths: 0,
    });
  });

  it('treats 0 earned from an uncatalogued course by its grade', () => {
    const unknownCourse = completedAttempt(
      { courseId: SYNTHETIC_COURSES.math102.id, grade: fail(), creditsEarnedHundredths: 0 },
      1,
    );

    expect(countRepeatCredit([unknownCourse], rules(UNCAPPED), CONTEXT)).toEqual({
      state: 'NONE',
      earnedCreditsHundredths: 0,
    });
  });
});
