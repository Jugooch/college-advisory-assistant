/**
 * @file Tests for a single required course: grades, attempt statuses, equivalents, and catalog gaps.
 */
import { describe, expect, it } from 'vitest';

import type { AcademicPolicyInput, CourseAttempt, PrerequisiteExpression } from '@caa/domain';
import {
  buildAcademicPolicy,
  buildPrerequisiteRule,
  completedAttempt,
  course,
  inProgressAttempt,
  letter,
  pass,
  pendingTransferAttempt,
  SYNTHETIC_COURSES,
  syntheticId,
  transferAwardedAttempt,
  withdrawnAttempt,
} from '@caa/test-kit';

import { evaluatePrerequisite } from './evaluate-prerequisite';

const COURSES = Object.values(SYNTHETIC_COURSES);
/** DEMO-MATH 101, equivalent to DEMO-MATH 111. */
const CALC_ID = SYNTHETIC_COURSES.math101.id;
const CALC_ALIAS_ID = SYNTHETIC_COURSES.math111.id;
/** DEMO-PHYS 201 has no equivalency group. */
const PHYSICS_ID = SYNTHETIC_COURSES.phys201.id;
/** A course ID that no synthetic catalog entry uses. */
const MISSING_ID = syntheticId('course', 0x999);
const CALC_MIN_C = course(CALC_ID, letter('C'));

/**
 * Evaluates a one-course rule and returns its check.
 *
 * @param attempts - The student's attempts.
 * @param policy - Policy switches to override.
 * @param expression - The rule's expression; DEMO-MATH 101 with a `C` minimum by default.
 * @returns The prerequisite check.
 */
function checkOf(
  attempts: readonly CourseAttempt[],
  policy: Partial<AcademicPolicyInput> = {},
  expression: PrerequisiteExpression = CALC_MIN_C,
): unknown {
  return evaluatePrerequisite(
    buildPrerequisiteRule({ expression }),
    { attempts, courses: COURSES },
    { academicPolicy: buildAcademicPolicy(policy), termCodesOldestFirst: ['2026SP', '2026FA'] },
  ).check;
}

/**
 * Builds the expected check.
 *
 * @param state - The expected state.
 * @param reasonCode - The expected reason code, omitted for PASS.
 * @returns The expected check result.
 */
function expected(state: string, reasonCode?: string): unknown {
  return {
    kind: 'PREREQUISITE',
    state,
    sourceRef: 'demo-rule-0001',
    ...(reasonCode === undefined ? {} : { reasonCode }),
  };
}

describe('evaluatePrerequisite for one required course', () => {
  it('passes when the counting attempt meets the minimum grade', () => {
    expect(checkOf([completedAttempt({ grade: letter('C') })])).toEqual(expected('PASS'));
  });

  it('fails with MIN_GRADE_NOT_MET when the counting attempt is below the minimum (AC01)', () => {
    expect(checkOf([completedAttempt({ grade: letter('D') })])).toEqual(
      expected('FAIL', 'MIN_GRADE_NOT_MET'),
    );
  });

  it('fails with NO_QUALIFYING_ATTEMPT when the course was never attempted', () => {
    expect(checkOf([])).toEqual(expected('FAIL', 'NO_QUALIFYING_ATTEMPT'));
  });

  it('fails with NO_QUALIFYING_ATTEMPT when the only attempt was withdrawn', () => {
    expect(checkOf([withdrawnAttempt()])).toEqual(expected('FAIL', 'NO_QUALIFYING_ATTEMPT'));
  });

  it('passes when the counting attempt is of an equivalent course', () => {
    const alias = completedAttempt({ courseId: CALC_ALIAS_ID, grade: letter('B') });

    expect(checkOf([alias])).toEqual(expected('PASS'));
  });

  it('is CONDITIONAL when in progress and the policy allows planned progression (AC02)', () => {
    expect(checkOf([inProgressAttempt()], { allowsInProgressPrerequisites: true })).toEqual(
      expected('CONDITIONAL', 'IN_PROGRESS_MIN_GRADE'),
    );
  });

  it('fails with PROGRESSION_NOT_PERMITTED when in progress and the policy forbids it', () => {
    expect(checkOf([inProgressAttempt()], { allowsInProgressPrerequisites: false })).toEqual(
      expected('FAIL', 'PROGRESSION_NOT_PERMITTED'),
    );
  });

  it('is UNKNOWN with PENDING_TRANSFER when only a pending transfer exists (AC03)', () => {
    expect(checkOf([pendingTransferAttempt()])).toEqual(expected('UNKNOWN', 'PENDING_TRANSFER'));
  });

  it('is UNKNOWN when the policy does not say whether P meets a letter minimum (AC19)', () => {
    expect(checkOf([completedAttempt({ grade: pass() })])).toEqual(
      expected('UNKNOWN', 'PASS_EQUIVALENCE_UNDEFINED'),
    );
  });

  it('passes a P against a letter minimum when the policy says P satisfies it', () => {
    const attempts = [completedAttempt({ grade: pass() })];

    expect(checkOf(attempts, { passSatisfiesMinimumGrade: true })).toEqual(expected('PASS'));
  });

  it('is UNKNOWN when no minimum is set and the policy has no passing cutoff', () => {
    const attempts = [completedAttempt({ grade: letter('D') })];

    expect(checkOf(attempts, {}, course(CALC_ID))).toEqual(
      expected('UNKNOWN', 'PASSING_GRADE_UNDEFINED'),
    );
  });

  it('passes an awarded transfer that carries a grade meeting the minimum', () => {
    expect(checkOf([transferAwardedAttempt({ grade: letter('B') })])).toEqual(expected('PASS'));
  });

  it('is UNKNOWN with GRADE_SCHEME_MISMATCH when the counting attempt has no grade', () => {
    expect(checkOf([transferAwardedAttempt()])).toEqual(
      expected('UNKNOWN', 'GRADE_SCHEME_MISMATCH'),
    );
  });

  it('is UNKNOWN when the repeat policy cannot pick the counting attempt', () => {
    const attempts = [
      completedAttempt({ grade: letter('A') }, 1),
      completedAttempt({ grade: letter('B'), termCode: '2026FA' }, 2),
    ];

    expect(checkOf(attempts, { repeatPolicy: null })).toEqual(
      expected('UNKNOWN', 'REPEAT_POLICY_UNDEFINED'),
    );
  });

  it('is UNKNOWN with COURSE_NOT_IN_CATALOG when the required course is not catalogued', () => {
    expect(checkOf([], {}, course(MISSING_ID))).toEqual(
      expected('UNKNOWN', 'COURSE_NOT_IN_CATALOG'),
    );
  });

  it('is UNKNOWN, not NO_QUALIFYING_ATTEMPT, when an uncatalogued attempt could be an equivalent', () => {
    const uncatalogued = completedAttempt({ courseId: MISSING_ID });

    expect(checkOf([uncatalogued], {}, course(PHYSICS_ID))).toEqual(
      expected('UNKNOWN', 'COURSE_NOT_IN_CATALOG'),
    );
  });

  it('fails a standalone course whose only attempts are of other courses', () => {
    const calc = completedAttempt({ courseId: CALC_ID });

    expect(checkOf([calc], {}, course(PHYSICS_ID))).toEqual(
      expected('FAIL', 'NO_QUALIFYING_ATTEMPT'),
    );
  });

  it('passes a standalone course from its own counting attempt', () => {
    const physics = completedAttempt({ courseId: PHYSICS_ID, grade: letter('A') });
    const calc = completedAttempt({ courseId: CALC_ID }, 2);

    expect(checkOf([calc, physics], {}, course(PHYSICS_ID, letter('C')))).toEqual(expected('PASS'));
  });
});
