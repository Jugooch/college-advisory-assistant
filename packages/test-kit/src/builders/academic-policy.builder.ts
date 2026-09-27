/**
 * @file Builds synthetic academic policies for tests.
 * @module @caa/test-kit/builders/academic-policy
 */
import {
  type AcademicPolicy,
  type AcademicPolicyInput,
  createAcademicPolicy,
  LetterGrade,
} from '@caa/domain';

import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';

/**
 * Synthetic letter grade order, highest first: `A+ A A- B+ B B- C+ C C- D+ D D- F`. It is test
 * configuration for the fictional tenants, not a claim about any real institution's policy.
 */
export const SYNTHETIC_LETTER_GRADE_ORDER: readonly LetterGrade[] = [
  LetterGrade.APlus,
  LetterGrade.A,
  LetterGrade.AMinus,
  LetterGrade.BPlus,
  LetterGrade.B,
  LetterGrade.BMinus,
  LetterGrade.CPlus,
  LetterGrade.C,
  LetterGrade.CMinus,
  LetterGrade.DPlus,
  LetterGrade.D,
  LetterGrade.DMinus,
  LetterGrade.F,
];

/**
 * Builds a valid academic policy for tenant A, ruleset `demo-2026.1`.
 *
 * The defaults are the conservative ones, each stated explicitly: in-progress prerequisites are
 * not allowed, whether `P` meets a letter minimum is undefined (`null`), and the repeat policy is
 * undefined (`null`). Override the switch a case is about. A policy has no identity, so this
 * builder takes no seed.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated academic policy.
 */
export function buildAcademicPolicy(overrides: Partial<AcademicPolicyInput> = {}): AcademicPolicy {
  return createAcademicPolicy({
    tenantId: SYNTHETIC_TENANTS.a.id,
    rulesetVersion: 'demo-2026.1',
    allowsInProgressPrerequisites: false,
    passSatisfiesMinimumGrade: null,
    letterGradeOrder: SYNTHETIC_LETTER_GRADE_ORDER,
    repeatPolicy: null,
    ...overrides,
  });
}
