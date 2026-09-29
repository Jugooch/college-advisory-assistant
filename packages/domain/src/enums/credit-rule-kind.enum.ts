/**
 * @file How a catalog course awards credits: a fixed value or a variable range.
 * @module @caa/domain/enums/credit-rule-kind
 * @requirement FR-05
 * @requirement FR-10
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

/**
 * Credit rule of a course, matching the two forms a `Course` states its credits in.
 *
 * - `FIXED`: the course always awards `creditsHundredths`.
 * - `VARIABLE`: the student chooses a value from `minCreditsHundredths` to
 *   `maxCreditsHundredths`. No value is assumed until the student chooses one.
 */
export const CreditRuleKind = {
  Fixed: 'FIXED',
  Variable: 'VARIABLE',
} as const;

/** Union of every {@link CreditRuleKind} value. */
export type CreditRuleKind = (typeof CreditRuleKind)[keyof typeof CreditRuleKind];

/** Runtime schema for {@link CreditRuleKind}. */
export const CreditRuleKindSchema = z.enum(CreditRuleKind);
