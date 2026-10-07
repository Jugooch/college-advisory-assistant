/**
 * @file Courses, attempts, and helpers shared by the repeat-for-credit golden cases (ADR-0012 §2).
 * @module @caa/test-kit/golden/golden-counting-fixtures
 * @requirement FR-06
 * @see docs/adr/0012-explicit-no-prerequisite-rules-and-repeat-for-credit-counting.md
 */
import { type Course, type CourseAttempt } from '@caa/domain';

import { buildCourse } from '../builders/course.builder';
import { completedAttempt } from '../builders/course-attempt.builder';
import { SYNTHETIC_REPEATABLE_COURSES } from '../fixtures/synthetic-courses';
import { syntheticId } from '../fixtures/synthetic-id';
import { COUNTING_TERM_CALENDAR } from './golden-counting-factories';

/** DEMO-ENS 110: 1.00 per attempt, 4 attempts, 4.00 credits. */
export const ENSEMBLE = SYNTHETIC_REPEATABLE_COURSES.ensemble110;

/** DEMO-TOP 280: 3.00 per attempt, uncapped. */
export const TOPICS = SYNTHETIC_REPEATABLE_COURSES.topics280;

/** A term the counting calendar doesn't list. */
export const UNLISTED_TERM = '2029SP';

/** A repeat cap: attempts, then credits in hundredths; `null` states no cap. */
export type RepeatCaps = readonly [maxAttempts: number | null, maxCreditsHundredths: number | null];

/**
 * A fixed-credit course (3.00) with the given repeat caps, distinguished by `seed`.
 *
 * @param seed - Course seed.
 * @param caps - Attempt cap and credit cap.
 * @param equivalencyGroupSeed - Equivalency group seed, or `null` for none.
 * @returns The course.
 */
export function repeatable(
  seed: number,
  caps: RepeatCaps,
  equivalencyGroupSeed: number | null = null,
): Course {
  return buildCourse(
    {
      repeatableForCredit: { maxAttempts: caps[0], maxCreditsHundredths: caps[1] },
      equivalencyGroupId:
        equivalencyGroupSeed === null
          ? null
          : syntheticId('equivalencyGroup', equivalencyGroupSeed),
    },
    seed,
  );
}

/** When an attempt happened and what it earned: term code, then credits in hundredths or `null`. */
export type TermAndCredits = readonly [termCode: string, credits: number | null];

/**
 * A completed attempt of a course.
 *
 * @param course - The course attempted.
 * @param seed - Attempt seed.
 * @param when - The term and the earned credit.
 * @returns The attempt.
 */
export function attemptOf(course: Course, seed: number, when: TermAndCredits): CourseAttempt {
  return completedAttempt(
    { courseId: course.id, termCode: when[0], creditsEarnedHundredths: when[1] },
    seed,
  );
}

/**
 * Attempts of a course in the first terms of the counting calendar, one per term.
 *
 * @param course - The course attempted.
 * @param count - How many terms, from `2025FA`.
 * @param credits - Credit each attempt earned, in hundredths.
 * @returns The attempts, oldest first.
 */
export function inTerms(course: Course, count: number, credits: number): CourseAttempt[] {
  return COUNTING_TERM_CALENDAR.slice(0, count).map((term, index) =>
    attemptOf(course, index + 1, [term.termCode, credits]),
  );
}

/**
 * Builds the claim that an earned total is wrong because a cap is already met.
 *
 * @param credits - The total, in hundredths, that must not be earned.
 * @returns The prohibited claim.
 */
export function notMore(credits: number): { earnedCreditsHundredths: number; claim: string } {
  return {
    earnedCreditsHundredths: credits,
    claim: `must not earn ${String(credits / 100)} credits: the attempt or credit cap is already met`,
  };
}
