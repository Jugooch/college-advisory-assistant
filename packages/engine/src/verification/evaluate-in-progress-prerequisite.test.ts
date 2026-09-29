/**
 * @file Tests for one required course when completed, in-progress, and pending attempts combine.
 */
import { describe, expect, it } from 'vitest';

import type { AcademicPolicyInput, CourseAttempt, PrerequisiteExpression } from '@caa/domain';
import {
  buildAcademicPolicy,
  buildPrerequisiteRule,
  buildTermCalendar,
  completedAttempt,
  course,
  inProgressAttempt,
  letter,
  pass,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { evaluatePrerequisite } from './evaluate-prerequisite';

const COURSES = Object.values(SYNTHETIC_COURSES);
const CALC_ID = SYNTHETIC_COURSES.math101.id;
/** DEMO-MATH 111 is equivalent to DEMO-MATH 101, the default rule's required course. */
const CALC_ALIAS_ID = SYNTHETIC_COURSES.math111.id;
const ALLOWS: Partial<AcademicPolicyInput> = { allowsInProgressPrerequisites: true };
const MOST_RECENT: Partial<AcademicPolicyInput> = { ...ALLOWS, repeatPolicy: 'MOST_RECENT' };
const HIGHEST_GRADE: Partial<AcademicPolicyInput> = { ...ALLOWS, repeatPolicy: 'HIGHEST_GRADE' };
/** Completed in 2026SP with a D, below the default rule's `C` minimum. */
const BELOW_MINIMUM = completedAttempt({ grade: letter('D') }, 1);
/** In progress in 2026FA, after 2026SP. */
const RETAKE = inProgressAttempt({}, 2);

/**
 * Evaluates a one-course rule and returns the state and reason.
 *
 * @param attempts - The student's attempts.
 * @param policy - Policy switches to override.
 * @param expression - The rule's expression; DEMO-MATH 101 with a `C` minimum by default.
 * @returns The check's state and reason code.
 */
function outcomeOf(
  attempts: readonly CourseAttempt[],
  policy: Partial<AcademicPolicyInput>,
  expression: PrerequisiteExpression = course(CALC_ID, letter('C')),
): readonly [string, string | undefined] {
  const check = evaluatePrerequisite(
    buildPrerequisiteRule({ expression }),
    { attempts, courses: COURSES },
    {
      academicPolicy: buildAcademicPolicy(policy),
      termCalendar: buildTermCalendar([{ termCode: '2026SP' }, { termCode: '2026FA' }]),
    },
  );
  return [check.state, check.reasonCode];
}

describe('evaluatePrerequisite with a completed attempt and a retake', () => {
  it('is CONDITIONAL for a retake after a below-minimum grade under MOST_RECENT', () => {
    expect(outcomeOf([BELOW_MINIMUM, RETAKE], MOST_RECENT)).toEqual([
      'CONDITIONAL',
      'IN_PROGRESS_MIN_GRADE',
    ]);
  });

  it('is CONDITIONAL for a retake after a below-minimum letter under HIGHEST_GRADE', () => {
    expect(outcomeOf([BELOW_MINIMUM, RETAKE], HIGHEST_GRADE)).toEqual([
      'CONDITIONAL',
      'IN_PROGRESS_MIN_GRADE',
    ]);
  });

  it('fails with PROGRESSION_NOT_PERMITTED for a retake when the policy forbids it', () => {
    const policy = { repeatPolicy: 'MOST_RECENT', allowsInProgressPrerequisites: false } as const;

    expect(outcomeOf([BELOW_MINIMUM, RETAKE], policy)).toEqual([
      'FAIL',
      'PROGRESSION_NOT_PERMITTED',
    ]);
  });

  it('is UNKNOWN for a retake when there is no repeat policy to make it count', () => {
    expect(outcomeOf([BELOW_MINIMUM, RETAKE], { ...ALLOWS, repeatPolicy: null })).toEqual([
      'UNKNOWN',
      'REPEAT_POLICY_UNDEFINED',
    ]);
  });

  it('is UNKNOWN under MOST_RECENT when the retake term is not in the term order', () => {
    const lateRetake = inProgressAttempt({ termCode: '2027SP' }, 2);

    expect(outcomeOf([BELOW_MINIMUM, lateRetake], MOST_RECENT)).toEqual([
      'UNKNOWN',
      'REPEAT_ORDER_UNDETERMINED',
    ]);
  });

  it('is UNKNOWN under MOST_RECENT when the completed attempt term is not in the term order', () => {
    const early = completedAttempt({ grade: letter('D'), termCode: '2025FA' }, 1);

    expect(outcomeOf([early, RETAKE], MOST_RECENT)).toEqual([
      'UNKNOWN',
      'REPEAT_ORDER_UNDETERMINED',
    ]);
  });

  it('is UNKNOWN under HIGHEST_GRADE when the failing grade is a P that cannot be ranked', () => {
    const passed = completedAttempt({ grade: pass() }, 1);
    const policy = { ...HIGHEST_GRADE, passSatisfiesMinimumGrade: false };

    expect(outcomeOf([passed, RETAKE], policy)).toEqual(['UNKNOWN', 'REPEAT_ORDER_UNDETERMINED']);
  });

  it('is UNKNOWN when the completed grade cannot be compared, even with a retake', () => {
    const policy = { ...MOST_RECENT, letterGradeOrder: ['A', 'B', 'C', 'F'] } as const;

    expect(outcomeOf([BELOW_MINIMUM, RETAKE], policy)).toEqual(['UNKNOWN', 'GRADE_NOT_RANKED']);
  });
});

describe('evaluatePrerequisite with a passing grade and a retake', () => {
  const passing = completedAttempt({ grade: letter('B') }, 1);

  it('is CONDITIONAL under MOST_RECENT, because the retake grade will replace the pass', () => {
    expect(outcomeOf([passing, RETAKE], MOST_RECENT)).toEqual([
      'CONDITIONAL',
      'IN_PROGRESS_MIN_GRADE',
    ]);
  });

  it('is UNKNOWN, not CONDITIONAL or FAIL, under MOST_RECENT when progression is forbidden', () => {
    const policy = { repeatPolicy: 'MOST_RECENT', allowsInProgressPrerequisites: false } as const;

    expect(outcomeOf([passing, RETAKE], policy)).toEqual(['UNKNOWN', 'PROGRESSION_NOT_PERMITTED']);
  });

  it('passes under HIGHEST_GRADE, because a retake cannot lower the counting grade', () => {
    expect(outcomeOf([passing, RETAKE], HIGHEST_GRADE)).toEqual(['PASS', undefined]);
  });

  it('is UNKNOWN when there is no repeat policy to say which attempt will count', () => {
    expect(outcomeOf([passing, RETAKE], { ...ALLOWS, repeatPolicy: null })).toEqual([
      'UNKNOWN',
      'REPEAT_POLICY_UNDEFINED',
    ]);
  });

  it('is UNKNOWN under MOST_RECENT when the retake term is not in the term order', () => {
    const lateRetake = inProgressAttempt({ termCode: '2027SP' }, 2);

    expect(outcomeOf([passing, lateRetake], MOST_RECENT)).toEqual([
      'UNKNOWN',
      'REPEAT_ORDER_UNDETERMINED',
    ]);
  });

  it('is UNKNOWN under MOST_RECENT when two retakes are in progress at once', () => {
    const aliasRetake = inProgressAttempt({ courseId: CALC_ALIAS_ID }, 3);

    expect(outcomeOf([passing, RETAKE, aliasRetake], MOST_RECENT)).toEqual([
      'UNKNOWN',
      'REPEAT_ORDER_UNDETERMINED',
    ]);
  });
});

describe('evaluatePrerequisite with a retake under HIGHEST_GRADE', () => {
  it('is UNKNOWN for a passing P against a letter minimum, since a letter retake is unrankable', () => {
    const passed = completedAttempt({ grade: pass() }, 1);
    const policy = { ...HIGHEST_GRADE, passSatisfiesMinimumGrade: true };

    expect(outcomeOf([passed, RETAKE], policy)).toEqual(['UNKNOWN', 'REPEAT_ORDER_UNDETERMINED']);
  });

  it('is UNKNOWN for a letter F against a P minimum, since a P retake is unrankable', () => {
    const failed = completedAttempt({ grade: letter('F') }, 1);

    expect(outcomeOf([failed, RETAKE], HIGHEST_GRADE, course(CALC_ID, pass()))).toEqual([
      'UNKNOWN',
      'REPEAT_ORDER_UNDETERMINED',
    ]);
  });

  it('is CONDITIONAL for a letter below the passing cutoff when the rule has no minimum', () => {
    const policy = { ...HIGHEST_GRADE, lowestPassingLetterGrade: 'C' } as const;

    expect(outcomeOf([BELOW_MINIMUM, RETAKE], policy, course(CALC_ID))).toEqual([
      'CONDITIONAL',
      'IN_PROGRESS_MIN_GRADE',
    ]);
  });

  it('passes a passing letter when the rule has no minimum', () => {
    const passing = completedAttempt({ grade: letter('B') }, 1);
    const policy = { ...HIGHEST_GRADE, lowestPassingLetterGrade: 'D' } as const;

    expect(outcomeOf([passing, RETAKE], policy, course(CALC_ID))).toEqual(['PASS', undefined]);
  });
});

describe('evaluatePrerequisite with several in-progress attempts', () => {
  const aliasRetake = inProgressAttempt({ courseId: CALC_ALIAS_ID }, 3);

  it('is UNKNOWN when two equivalents are in progress and there is no repeat policy', () => {
    expect(outcomeOf([RETAKE, aliasRetake], ALLOWS)).toEqual([
      'UNKNOWN',
      'REPEAT_POLICY_UNDEFINED',
    ]);
  });

  it('is UNKNOWN when two equivalents are in progress and nothing counts yet', () => {
    expect(outcomeOf([RETAKE, aliasRetake], MOST_RECENT)).toEqual([
      'UNKNOWN',
      'REPEAT_ORDER_UNDETERMINED',
    ]);
  });

  it('is UNKNOWN when two retakes follow a below-minimum grade', () => {
    expect(outcomeOf([BELOW_MINIMUM, RETAKE, aliasRetake], MOST_RECENT)).toEqual([
      'UNKNOWN',
      'REPEAT_ORDER_UNDETERMINED',
    ]);
  });
});
