/**
 * @file Tests for evaluating an explicit "no prerequisite" rule (ADR-0012 §1).
 */
import { describe, expect, it } from 'vitest';

import {
  type AcademicPolicyInput,
  type CheckResult,
  type Course,
  type CourseAttempt,
  createPrerequisiteRootExpression,
} from '@caa/domain';
import {
  buildAcademicPolicy,
  buildPrerequisiteRule,
  buildTermCalendar,
  completedAttempt,
  letter,
  SYNTHETIC_COURSES,
  syntheticId,
} from '@caa/test-kit';

import { evaluatePrerequisite, type RootPrerequisiteRule } from './evaluate-prerequisite';
import { PrerequisiteInputMismatchError } from './prerequisite-evaluation';

const COURSES = Object.values(SYNTHETIC_COURSES);
const CALC_F = completedAttempt({ courseId: SYNTHETIC_COURSES.math101.id, grade: letter('F') }, 1);

/** A rule for DEMO-MATH 102 stating it has no prerequisite. */
const NONE_RULE: RootPrerequisiteRule = {
  ...buildPrerequisiteRule({}, 7),
  expression: createPrerequisiteRootExpression({ type: 'NONE' }),
};

/** The PASS every `NONE` rule gives under its own ruleset. */
const NONE_PASS = {
  kind: 'PREREQUISITE',
  state: 'PASS',
  sourceRef: 'demo-rule-0007',
  evidence: { rulesetVersion: 'demo-2026.1', decisiveLeaves: [] },
};

/**
 * Evaluates the `NONE` rule.
 *
 * @param attempts - The student's attempts.
 * @param courses - The catalog.
 * @param policy - Policy fields to override.
 * @returns The prerequisite check.
 */
function evaluateNone(
  attempts: readonly CourseAttempt[],
  courses: readonly Course[] = COURSES,
  policy: Partial<AcademicPolicyInput> = {},
): CheckResult {
  return evaluatePrerequisite(
    NONE_RULE,
    { attempts, courses },
    {
      academicPolicy: buildAcademicPolicy(policy),
      termCalendar: buildTermCalendar([{ termCode: '2026SP' }]),
    },
  );
}

describe('evaluatePrerequisite with a NONE rule', () => {
  it('passes with the rule source and no decisive leaves when there are no attempts', () => {
    expect(evaluateNone([])).toEqual(NONE_PASS);
  });

  it('passes even when the catalog misses an attempted course', () => {
    expect(evaluateNone([CALC_F], [])).toEqual(NONE_PASS);
  });

  it('passes whatever grades the record holds', () => {
    expect(evaluateNone([CALC_F])).toEqual(NONE_PASS);
  });

  it('returns a deep-equal result when replayed with the same inputs (NFR-01)', () => {
    expect(evaluateNone([CALC_F], [])).toEqual(evaluateNone([CALC_F], []));
  });

  it('still throws when the policy belongs to another ruleset version', () => {
    const run = (): unknown => evaluateNone([], COURSES, { rulesetVersion: 'demo-2025.1' });

    expect(run).toThrow(PrerequisiteInputMismatchError);
    expect(run).toThrow('different rulesetVersion values');
  });

  it('still throws when the policy belongs to another tenant', () => {
    const run = (): unknown => evaluateNone([], COURSES, { tenantId: syntheticId('tenant', 9) });

    expect(run).toThrow('different tenantId values');
  });
});
