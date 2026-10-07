/**
 * @file Tests for counting the attempts of a course that is repeatable for credit.
 */
import { describe, expect, it } from 'vitest';

import type { CourseAttempt, RepeatableForCredit } from '@caa/domain';
import {
  buildAcademicPolicy,
  buildTermCalendar,
  completedAttempt,
  fail,
  letter,
  SYNTHETIC_REPEATABLE_COURSES,
  transferAwardedAttempt,
} from '@caa/test-kit';

import { countRepeatCredit } from './count-repeat-credit';
import type { AttemptResolutionContext } from './select-counting-attempt';

const ENSEMBLE = SYNTHETIC_REPEATABLE_COURSES.ensemble110;
/** DEMO-ENS 110: 4 attempts, 4.00 credits. */
const ENSEMBLE_CAPS: RepeatableForCredit = { maxAttempts: 4, maxCreditsHundredths: 400 };
const UNCAPPED: RepeatableForCredit = { maxAttempts: null, maxCreditsHundredths: null };
const TWO_ATTEMPTS: RepeatableForCredit = { maxAttempts: 2, maxCreditsHundredths: null };

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

/**
 * Builds a completed ensemble attempt.
 *
 * @param termCode - The attempt's term.
 * @param seed - The attempt's seed, which drives its `id`.
 * @param overrides - Other fields to replace.
 * @returns The attempt, 1.00 credit with a `B` by default.
 */
function ensemble(
  termCode: string,
  seed: number,
  overrides: Partial<CourseAttempt> = {},
): CourseAttempt {
  return completedAttempt(
    { courseId: ENSEMBLE.id, termCode, creditsEarnedHundredths: 100, ...overrides },
    seed,
  );
}

const FIVE_TERMS = [
  ensemble('2024SP', 1),
  ensemble('2024FA', 2),
  ensemble('2025SP', 3),
  ensemble('2025FA', 4),
  ensemble('2026SP', 5),
];

describe('countRepeatCredit', () => {
  it('counts the first four of five ensemble attempts, earning 4.00 credits', () => {
    const [first, second, third, fourth] = FIVE_TERMS;

    expect(countRepeatCredit(FIVE_TERMS, ENSEMBLE_CAPS, CONTEXT)).toEqual({
      state: 'COUNTED',
      attempts: [first, second, third, fourth],
      earnedCreditsHundredths: 400,
    });
  });

  it('gives the same result whatever the input order', () => {
    const reversed = [...FIVE_TERMS].reverse();

    expect(countRepeatCredit(reversed, ENSEMBLE_CAPS, CONTEXT)).toEqual(
      countRepeatCredit(FIVE_TERMS, ENSEMBLE_CAPS, CONTEXT),
    );
  });

  it('counts every attempt when there are exactly as many as the attempt cap', () => {
    const four = FIVE_TERMS.slice(0, 4);

    expect(countRepeatCredit(four, ENSEMBLE_CAPS, CONTEXT)).toEqual({
      state: 'COUNTED',
      attempts: four,
      earnedCreditsHundredths: 400,
    });
  });

  it('sums every attempt of an uncapped course', () => {
    const first = completedAttempt({ termCode: '2025SP' }, 1);
    const second = transferAwardedAttempt({ termCode: '2025FA' }, 2);

    expect(countRepeatCredit([second, first], UNCAPPED, CONTEXT)).toEqual({
      state: 'COUNTED',
      attempts: [first, second],
      earnedCreditsHundredths: 600,
    });
  });

  it('caps the earned credits at maxCreditsHundredths when two attempts exceed it', () => {
    const attempts = [
      completedAttempt({ termCode: '2025SP' }, 1),
      completedAttempt({ termCode: '2025FA' }, 2),
    ];
    const caps = { maxAttempts: null, maxCreditsHundredths: 400 };

    expect(countRepeatCredit(attempts, caps, CONTEXT)).toEqual({
      state: 'COUNTED',
      attempts,
      earnedCreditsHundredths: 400,
    });
  });

  it('earns exactly maxCreditsHundredths when the attempts sum to it', () => {
    const attempts = [
      completedAttempt({ termCode: '2025SP' }, 1),
      completedAttempt({ termCode: '2025FA' }, 2),
    ];
    const caps = { maxAttempts: null, maxCreditsHundredths: 600 };

    expect(countRepeatCredit(attempts, caps, CONTEXT)).toMatchObject({
      earnedCreditsHundredths: 600,
    });
  });

  it("doesn't use up maxAttempts with a failed attempt that earned 0 credits", () => {
    const first = completedAttempt({ termCode: '2024SP' }, 1);
    const failed = completedAttempt(
      { termCode: '2024FA', grade: letter('F'), creditsEarnedHundredths: 0 },
      2,
    );
    const third = completedAttempt({ termCode: '2025SP' }, 3);

    expect(countRepeatCredit([third, failed, first], TWO_ATTEMPTS, CONTEXT)).toEqual({
      state: 'COUNTED',
      attempts: [first, third],
      earnedCreditsHundredths: 600,
    });
  });

  it('counts nothing when every attempt earned 0 credits, or there are none', () => {
    const failed = completedAttempt({ grade: fail(), creditsEarnedHundredths: 0 }, 1);
    const none = { state: 'NONE', earnedCreditsHundredths: 0 };

    expect(countRepeatCredit([failed], UNCAPPED, CONTEXT)).toEqual(none);
    expect(countRepeatCredit([], UNCAPPED, CONTEXT)).toEqual(none);
  });

  it('leaves earned credit unknown when a counted attempt has no recorded award', () => {
    const first = completedAttempt({ termCode: '2025SP' }, 1);
    const unknown = completedAttempt({ termCode: '2025FA', creditsEarnedHundredths: null }, 2);

    expect(countRepeatCredit([first, unknown], UNCAPPED, CONTEXT)).toEqual({
      state: 'COUNTED',
      attempts: [first, unknown],
      earnedCreditsHundredths: null,
    });
  });

  it('is undetermined when an unknown award falls before the attempt cap cut', () => {
    const attempts = [
      completedAttempt({ termCode: '2024SP', creditsEarnedHundredths: null }, 1),
      completedAttempt({ termCode: '2024FA' }, 2),
      completedAttempt({ termCode: '2025SP' }, 3),
    ];

    expect(countRepeatCredit(attempts, TWO_ATTEMPTS, CONTEXT)).toEqual(ORDER_UNDETERMINED);
  });

  it('ignores an unknown award that the attempt cap leaves out', () => {
    const first = completedAttempt({ termCode: '2024SP' }, 1);
    const second = completedAttempt({ termCode: '2024FA' }, 2);
    const late = completedAttempt({ termCode: '2025SP', creditsEarnedHundredths: null }, 3);

    expect(countRepeatCredit([late, second, first], TWO_ATTEMPTS, CONTEXT)).toEqual({
      state: 'COUNTED',
      attempts: [first, second],
      earnedCreditsHundredths: 600,
    });
  });

  it('is undetermined when the cut falls in one term between attempts of different credits', () => {
    const attempts = [
      completedAttempt({ termCode: '2024SP' }, 1),
      completedAttempt({ termCode: '2024FA' }, 2),
      completedAttempt({ termCode: '2024FA', creditsEarnedHundredths: 150 }, 3),
    ];

    expect(countRepeatCredit(attempts, TWO_ATTEMPTS, CONTEXT)).toEqual(ORDER_UNDETERMINED);
  });

  it('is undetermined when the cut falls in one term between attempts of different grades', () => {
    const attempts = [
      completedAttempt({ termCode: '2024SP' }, 1),
      completedAttempt({ termCode: '2024FA', grade: letter('D') }, 2),
      completedAttempt({ termCode: '2024FA' }, 3),
    ];

    expect(countRepeatCredit(attempts, TWO_ATTEMPTS, CONTEXT)).toEqual(ORDER_UNDETERMINED);
  });

  it('breaks a same-term tie of equal credits and grades at the cut by attempt id', () => {
    const first = completedAttempt({ termCode: '2024SP' }, 1);
    const lowerId = completedAttempt({ termCode: '2024FA' }, 2);
    const higherId = completedAttempt({ termCode: '2024FA' }, 3);

    expect(countRepeatCredit([higherId, lowerId, first], TWO_ATTEMPTS, CONTEXT)).toEqual({
      state: 'COUNTED',
      attempts: [first, lowerId],
      earnedCreditsHundredths: 600,
    });
  });

  it('settles a same-term tie that falls wholly before the cut', () => {
    const lowerId = completedAttempt({ termCode: '2024SP' }, 1);
    const higherId = completedAttempt({ termCode: '2024SP', creditsEarnedHundredths: 150 }, 2);
    const later = completedAttempt({ termCode: '2024FA' }, 3);
    const caps = { maxAttempts: 2, maxCreditsHundredths: 400 };

    expect(countRepeatCredit([later, higherId, lowerId], caps, CONTEXT)).toEqual({
      state: 'COUNTED',
      attempts: [lowerId, higherId],
      earnedCreditsHundredths: 400,
    });
  });

  it('is undetermined when a term missing from the calendar meets a binding attempt cap', () => {
    const attempts = [
      completedAttempt({ termCode: '2024SP' }, 1),
      completedAttempt({ termCode: '2024FA' }, 2),
      completedAttempt({ termCode: '1999XX' }, 3),
    ];

    expect(countRepeatCredit(attempts, TWO_ATTEMPTS, CONTEXT)).toEqual(ORDER_UNDETERMINED);
  });

  it('counts an attempt in a term missing from the calendar when no attempt cap binds', () => {
    const unplaced = completedAttempt({ termCode: '1999XX' }, 1);
    const placed = completedAttempt({ termCode: '2024SP' }, 2);

    expect(countRepeatCredit([unplaced, placed], UNCAPPED, CONTEXT)).toEqual({
      state: 'COUNTED',
      attempts: [placed, unplaced],
      earnedCreditsHundredths: 600,
    });
  });
});
