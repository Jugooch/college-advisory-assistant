/**
 * @file Tests for one required course when a pending transfer sits beside other attempts.
 */
import { describe, expect, it } from 'vitest';

import type { AcademicPolicyInput, CourseAttempt } from '@caa/domain';
import {
  buildAcademicPolicy,
  buildPrerequisiteRule,
  buildTermCalendar,
  completedAttempt,
  inProgressAttempt,
  letter,
  pendingTransferAttempt,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { evaluatePrerequisite } from './evaluate-prerequisite';

const COURSES = Object.values(SYNTHETIC_COURSES);
/** DEMO-MATH 111 is equivalent to DEMO-MATH 101, the default rule's required course. */
const CALC_ALIAS_ID = SYNTHETIC_COURSES.math111.id;

/**
 * Evaluates the default rule (DEMO-MATH 101 with a `C` minimum) and returns its check without
 * the evidence.
 *
 * @param attempts - The student's attempts.
 * @param policy - Policy switches to override.
 * @returns The check's kind, state, source reference, and reason code.
 */
function checkOf(
  attempts: readonly CourseAttempt[],
  policy: Partial<AcademicPolicyInput> = {},
): unknown {
  const check = evaluatePrerequisite(
    buildPrerequisiteRule(),
    { attempts, courses: COURSES },
    {
      academicPolicy: buildAcademicPolicy(policy),
      termCalendar: buildTermCalendar([{ termCode: '2026SP' }, { termCode: '2026FA' }]),
    },
  );
  return {
    kind: check.kind,
    state: check.state,
    sourceRef: check.sourceRef,
    reasonCode: check.reasonCode,
  };
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

describe('evaluatePrerequisite with a pending transfer', () => {
  const pending = pendingTransferAttempt({}, 4);
  const retake = inProgressAttempt({}, 2);

  it('passes on a completed grade that meets the minimum, despite a pending transfer', () => {
    expect(checkOf([completedAttempt({ grade: letter('C') }, 1), pending])).toEqual(
      expected('PASS'),
    );
  });

  it('is UNKNOWN with PENDING_TRANSFER when the completed grade is below the minimum', () => {
    expect(checkOf([completedAttempt({ grade: letter('D') }, 1), pending])).toEqual(
      expected('UNKNOWN', 'PENDING_TRANSFER'),
    );
  });

  it('is UNKNOWN with PENDING_TRANSFER when in-progress work is not permitted', () => {
    const policy = { allowsInProgressPrerequisites: false, repeatPolicy: 'MOST_RECENT' } as const;

    expect(checkOf([retake, pending], policy)).toEqual(expected('UNKNOWN', 'PENDING_TRANSFER'));
  });

  it('is UNKNOWN, not CONDITIONAL, beside a pending transfer with no repeat policy', () => {
    const policy = { allowsInProgressPrerequisites: true, repeatPolicy: null };

    expect(checkOf([retake, pending], policy)).toEqual(
      expected('UNKNOWN', 'REPEAT_POLICY_UNDEFINED'),
    );
  });

  it('is UNKNOWN beside a pending transfer of an equivalent with no repeat policy', () => {
    const aliasPending = pendingTransferAttempt({ courseId: CALC_ALIAS_ID }, 5);
    const policy = { allowsInProgressPrerequisites: true, repeatPolicy: null };

    expect(checkOf([retake, aliasPending], policy)).toEqual(
      expected('UNKNOWN', 'REPEAT_POLICY_UNDEFINED'),
    );
  });

  it('is UNKNOWN, not CONDITIONAL, under MOST_RECENT with the transfer in a later term', () => {
    const earlyRetake = inProgressAttempt({ termCode: '2026SP' }, 2);
    const latePending = pendingTransferAttempt({ termCode: '2026FA' }, 4);
    const policy = { allowsInProgressPrerequisites: true, repeatPolicy: 'MOST_RECENT' } as const;

    expect(checkOf([earlyRetake, latePending], policy)).toEqual(
      expected('UNKNOWN', 'PENDING_TRANSFER'),
    );
  });

  it('is UNKNOWN, not CONDITIONAL, beside a pending transfer under HIGHEST_GRADE', () => {
    const policy = { allowsInProgressPrerequisites: true, repeatPolicy: 'HIGHEST_GRADE' } as const;

    expect(checkOf([retake, pending], policy)).toEqual(expected('UNKNOWN', 'PENDING_TRANSFER'));
  });

  it('is UNKNOWN, not PASS, for a passing grade with both a retake and a pending transfer', () => {
    const passing = completedAttempt({ grade: letter('B') }, 1);
    const policy = { allowsInProgressPrerequisites: true, repeatPolicy: 'HIGHEST_GRADE' } as const;

    expect(checkOf([passing, retake, pending], policy)).toEqual(
      expected('UNKNOWN', 'PENDING_TRANSFER'),
    );
  });
});
