/**
 * @file Tests for evaluating AND/OR prerequisite trees, their evidence, and replay determinism.
 */
import { describe, expect, it } from 'vitest';

import type { AcademicPolicyInput, CourseAttempt, PrerequisiteExpression } from '@caa/domain';
import {
  all,
  any,
  buildAcademicPolicy,
  buildPrerequisiteRule,
  completedAttempt,
  course,
  inProgressAttempt,
  letter,
  SYNTHETIC_COURSES,
  syntheticId,
  unsupported,
} from '@caa/test-kit';

import { evaluatePrerequisite } from './evaluate-prerequisite';
import {
  type PrerequisiteEvaluation,
  PrerequisiteInputMismatchError,
} from './prerequisite-evaluation';

const COURSES = Object.values(SYNTHETIC_COURSES);
const CALC_ID = SYNTHETIC_COURSES.math101.id;
const PHYSICS_ID = SYNTHETIC_COURSES.phys201.id;
const LAB_ID = SYNTHETIC_COURSES.phys201Lab.id;
const CALC_D = completedAttempt({ courseId: CALC_ID, grade: letter('D') }, 1);
const PHYSICS_A = completedAttempt({ courseId: PHYSICS_ID, grade: letter('A') }, 2);
const CONSENT = unsupported('or consent of the department');

/**
 * Evaluates a rule with the given expression.
 *
 * @param expression - The rule's expression.
 * @param attempts - The student's attempts.
 * @param policy - Policy switches to override.
 * @returns The evaluation.
 */
function evaluate(
  expression: PrerequisiteExpression,
  attempts: readonly CourseAttempt[],
  policy: Partial<AcademicPolicyInput> = {},
): PrerequisiteEvaluation {
  return evaluatePrerequisite(
    buildPrerequisiteRule({ expression }),
    { attempts, courses: COURSES },
    { academicPolicy: buildAcademicPolicy(policy), termCodesOldestFirst: ['2026SP', '2026FA'] },
  );
}

describe('evaluatePrerequisite combination', () => {
  it('is UNKNOWN, never FAIL or PASS, for an ANY of an UNKNOWN and a FAIL', () => {
    expect(evaluate(any(course(CALC_ID, letter('C')), CONSENT), [CALC_D]).check.state).toBe(
      'UNKNOWN',
    );
  });

  it('fails an ALL when one child fails, even if another is UNKNOWN', () => {
    const result = evaluate(all(CONSENT, course(CALC_ID, letter('C'))), [CALC_D]);

    expect(result.check).toEqual({
      kind: 'PREREQUISITE',
      state: 'FAIL',
      reasonCode: 'MIN_GRADE_NOT_MET',
      sourceRef: 'demo-rule-0001',
    });
  });

  it('passes an ANY when one alternative passes and another fails', () => {
    const expression = any(course(CALC_ID, letter('C')), course(PHYSICS_ID));
    const policy = { lowestPassingLetterGrade: 'D' } as const;

    expect(evaluate(expression, [CALC_D, PHYSICS_A], policy).check.state).toBe('PASS');
  });

  it('propagates UNKNOWN from a nested ANY through an ALL whose other child passes', () => {
    const expression = all(course(PHYSICS_ID, letter('C')), any(CONSENT, course(LAB_ID)));

    expect(evaluate(expression, [PHYSICS_A]).check).toEqual({
      kind: 'PREREQUISITE',
      state: 'UNKNOWN',
      reasonCode: 'UNSUPPORTED_RULE',
      sourceRef: 'demo-rule-0001',
    });
  });

  it('is UNKNOWN with the node reason code for an UNSUPPORTED root', () => {
    const result = evaluate(unsupported('placement exam', 'AUDIT_AMBIGUOUS'), []);

    expect(result.decisiveLeaves).toEqual([
      {
        type: 'UNSUPPORTED',
        path: [],
        state: 'UNKNOWN',
        reasonCode: 'AUDIT_AMBIGUOUS',
        sourceText: 'placement exam',
      },
    ]);
  });

  it('is UNKNOWN with UNSUPPORTED_RULE and no decisive leaf for an empty group', () => {
    // NOTE: the domain rejects empty groups, so the rule is spread past the factory to reach
    // the engine's defensive path.
    const rule = { ...buildPrerequisiteRule(), expression: { type: 'ALL', items: [] } } as const;
    const context = { academicPolicy: buildAcademicPolicy(), termCodesOldestFirst: [] };

    expect(evaluatePrerequisite(rule, { attempts: [], courses: COURSES }, context)).toMatchObject({
      check: { state: 'UNKNOWN', reasonCode: 'UNSUPPORTED_RULE' },
      decisiveLeaves: [],
    });
  });
});

describe('evaluatePrerequisite evidence', () => {
  it('reports the in-progress leaf, its path, and the required grade (AC02)', () => {
    const retake = inProgressAttempt({ courseId: CALC_ID }, 3);
    const expression = all(course(PHYSICS_ID), course(CALC_ID, letter('C')));
    const policy = { allowsInProgressPrerequisites: true, lowestPassingLetterGrade: 'D' } as const;

    expect(evaluate(expression, [PHYSICS_A, retake], policy)).toEqual({
      check: {
        kind: 'PREREQUISITE',
        state: 'CONDITIONAL',
        reasonCode: 'IN_PROGRESS_MIN_GRADE',
        sourceRef: 'demo-rule-0001',
      },
      courseId: SYNTHETIC_COURSES.math102.id,
      rulesetVersion: 'demo-2026.1',
      decisiveLeaves: [
        {
          type: 'COURSE',
          path: [1],
          state: 'CONDITIONAL',
          reasonCode: 'IN_PROGRESS_MIN_GRADE',
          courseId: CALC_ID,
          requiredGrade: { scheme: 'LETTER', value: 'C' },
          attemptIds: [syntheticId('attempt', 3)],
        },
      ],
    });
  });

  it('reports the required grade when a MOST_RECENT retake could replace a pass', () => {
    const passing = completedAttempt({ courseId: CALC_ID, grade: letter('B') }, 1);
    const retake = inProgressAttempt({ courseId: CALC_ID }, 3);
    const policy = { repeatPolicy: 'MOST_RECENT' } as const;

    expect(
      evaluate(course(CALC_ID, letter('C')), [passing, retake], policy).decisiveLeaves,
    ).toEqual([
      {
        type: 'COURSE',
        path: [],
        state: 'CONDITIONAL',
        reasonCode: 'IN_PROGRESS_MIN_GRADE',
        courseId: CALC_ID,
        requiredGrade: { scheme: 'LETTER', value: 'C' },
        attemptIds: [syntheticId('attempt', 1), syntheticId('attempt', 3)],
      },
    ]);
  });

  it('reports every passing leaf of a passing ALL, with a null reason code', () => {
    const expression = all(course(PHYSICS_ID, letter('B')), any(CONSENT, course(PHYSICS_ID)));
    const policy = { lowestPassingLetterGrade: 'D' } as const;

    expect(evaluate(expression, [PHYSICS_A], policy).decisiveLeaves).toEqual([
      expect.objectContaining({ path: [0], state: 'PASS', reasonCode: null }),
      expect.objectContaining({ path: [1, 1], state: 'PASS', reasonCode: null }),
    ]);
  });

  it('omits the reason code from a passing check', () => {
    expect(evaluate(course(PHYSICS_ID, letter('C')), [PHYSICS_A]).check).toEqual({
      kind: 'PREREQUISITE',
      state: 'PASS',
      sourceRef: 'demo-rule-0001',
    });
  });

  it('reports no attempt IDs for a course that is not in the catalog', () => {
    const missing = course(syntheticId('course', 0x999));

    expect(evaluate(missing, [PHYSICS_A]).decisiveLeaves).toEqual([
      expect.objectContaining({ reasonCode: 'COURSE_NOT_IN_CATALOG', attemptIds: [] }),
    ]);
  });

  it('reports no attempt IDs for a course that was never attempted', () => {
    expect(evaluate(course(LAB_ID), [PHYSICS_A]).decisiveLeaves).toEqual([
      expect.objectContaining({ reasonCode: 'NO_QUALIFYING_ATTEMPT', attemptIds: [] }),
    ]);
  });
});

describe('evaluatePrerequisite determinism and inputs', () => {
  it('returns a deep-equal result when replayed with the same inputs (NFR-01)', () => {
    const expression = all(any(course(CALC_ID, letter('C')), CONSENT), course(PHYSICS_ID));
    const attempts = [CALC_D, PHYSICS_A, inProgressAttempt({ courseId: CALC_ID }, 3)];
    const policy = { allowsInProgressPrerequisites: true, repeatPolicy: 'MOST_RECENT' } as const;

    expect(evaluate(expression, attempts, policy)).toEqual(evaluate(expression, attempts, policy));
  });

  it('throws when the policy belongs to another ruleset version', () => {
    const run = (): unknown => evaluate(course(CALC_ID), [], { rulesetVersion: 'demo-2025.1' });

    expect(run).toThrow(PrerequisiteInputMismatchError);
  });

  it('throws when the policy belongs to another tenant', () => {
    const run = (): unknown =>
      evaluate(course(CALC_ID), [], { tenantId: syntheticId('tenant', 9) });

    expect(run).toThrow('different tenantId values');
  });
});
