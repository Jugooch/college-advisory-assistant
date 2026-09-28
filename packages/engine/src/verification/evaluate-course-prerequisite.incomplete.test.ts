/**
 * @file Tests that an INCOMPLETE (deferred-grade) attempt keeps a required course UNKNOWN.
 */
import { describe, expect, it } from 'vitest';

import type { AcademicPolicyInput, CourseAttempt } from '@caa/domain';
import {
  buildAcademicPolicy,
  buildPrerequisiteRule,
  completedAttempt,
  incompleteAttempt,
  letter,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { evaluatePrerequisite } from './evaluate-prerequisite';

const COURSES = Object.values(SYNTHETIC_COURSES);
/** DEMO-MATH 111 is equivalent to DEMO-MATH 101, the default rule's required course. */
const CALC_ALIAS_ID = SYNTHETIC_COURSES.math111.id;
/** Completed in 2026SP with a C, meeting the default rule's `C` minimum. */
const PASSING = completedAttempt({ grade: letter('C') }, 1);
/** Deferred grade in 2026FA, after 2026SP. */
const DEFERRED = incompleteAttempt({ termCode: '2026FA' }, 2);

/**
 * Evaluates the default rule (DEMO-MATH 101 with a `C` minimum) and returns the state and reason.
 *
 * @param attempts - The student's attempts.
 * @param policy - Policy switches to override.
 * @returns The check's state and reason code.
 */
function outcomeOf(
  attempts: readonly CourseAttempt[],
  policy: Partial<AcademicPolicyInput> = {},
): readonly [string, string | undefined] {
  const check = evaluatePrerequisite(
    buildPrerequisiteRule(),
    { attempts, courses: COURSES },
    { academicPolicy: buildAcademicPolicy(policy), termCodesOldestFirst: ['2026SP', '2026FA'] },
  );
  return [check.state, check.reasonCode];
}

describe('evaluatePrerequisite with an INCOMPLETE attempt', () => {
  it('is UNKNOWN, not PASS, for a passing grade and a later INCOMPLETE under MOST_RECENT', () => {
    expect(outcomeOf([PASSING, DEFERRED], { repeatPolicy: 'MOST_RECENT' })).toEqual([
      'UNKNOWN',
      'INCOMPLETE_ATTEMPT',
    ]);
  });

  it('is UNKNOWN, not PASS, for a passing grade and an INCOMPLETE with no repeat policy', () => {
    expect(outcomeOf([PASSING, DEFERRED], { repeatPolicy: null })).toEqual([
      'UNKNOWN',
      'INCOMPLETE_ATTEMPT',
    ]);
  });

  it('is UNKNOWN, not FAIL, when the only attempt is INCOMPLETE', () => {
    expect(outcomeOf([DEFERRED])).toEqual(['UNKNOWN', 'INCOMPLETE_ATTEMPT']);
  });

  it('is UNKNOWN when the INCOMPLETE attempt is of an equivalent course', () => {
    const aliasDeferred = incompleteAttempt({ courseId: CALC_ALIAS_ID, termCode: '2026FA' }, 3);

    expect(outcomeOf([PASSING, aliasDeferred], { repeatPolicy: 'HIGHEST_GRADE' })).toEqual([
      'UNKNOWN',
      'INCOMPLETE_ATTEMPT',
    ]);
  });
});
