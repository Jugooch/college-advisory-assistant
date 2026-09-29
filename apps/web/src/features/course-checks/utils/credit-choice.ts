/**
 * @file Credit choices for variable-credit courses: the field names, parsing the typed value,
 * checking it against the catalog range, and the wording of a credit rule.
 * @module @caa/web/features/course-checks/utils/credit-choice
 * @requirement FR-05
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import type { CreditRule } from '@caa/api-contract';
import { CreditRuleKind } from '@caa/domain';

import { formatCredits } from '@/shared/utils/format-display';

/** A variable credit rule: the range the student chooses from. */
type VariableRule = Extract<CreditRule, { readonly kind: 'VARIABLE' }>;

/** Prefix of the query field that carries one course's typed credit value. */
export const CREDIT_FIELD_PREFIX = 'credits-';

/** The credit fields of a submission, and what was wrong with them. */
export interface CreditChoices {
  /** Typed credit text by course ID, to fill the fields again. */
  readonly inputs: ReadonlyMap<string, string>;
  /** Why a typed value was rejected, by course ID. */
  readonly errors: ReadonlyMap<string, string>;
}

/** What one typed credit value amounts to. */
export type CreditChoice =
  /** Nothing typed: no value is chosen, and none is assumed. */
  | { readonly kind: 'blank' }
  | { readonly kind: 'chosen'; readonly hundredths: number }
  | { readonly kind: 'invalid'; readonly message: string };

/**
 * Names the query field for one course's credit value.
 *
 * @param courseId - The course's ID.
 * @returns For example `credits-50000000-0000-4000-8000-000000000390`.
 */
export function creditFieldName(courseId: string): string {
  return `${CREDIT_FIELD_PREFIX}${courseId}`;
}

/**
 * Parses typed credits into hundredths with integer arithmetic, so no rounding occurs.
 *
 * @param text - The typed value, for example `2` or `2.5`.
 * @returns The hundredths (250 for `2.5`), or null when it isn't a plain number of credits with
 *   at most two decimals.
 */
export function parseCreditText(text: string): number | null {
  const match = /^(\d{1,2})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (match === null) {
    return null;
  }
  const [, whole = '0', fraction = ''] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/**
 * Checks one typed credit value against the course's catalog range.
 *
 * @param text - The typed value, or undefined when the field wasn't sent.
 * @param rule - The course's variable credit rule.
 * @returns Blank, the chosen hundredths, or why the value was rejected.
 */
export function readCreditChoice(text: string | undefined, rule: VariableRule): CreditChoice {
  if (text === undefined || text.trim() === '') {
    return { kind: 'blank' };
  }
  const hundredths = parseCreditText(text);
  if (hundredths === null) {
    return { kind: 'invalid', message: 'Enter a number of credits, such as 2 or 2.5.' };
  }
  if (hundredths < rule.minCreditsHundredths || hundredths > rule.maxCreditsHundredths) {
    const min = formatCredits(rule.minCreditsHundredths);
    const max = formatCredits(rule.maxCreditsHundredths);
    return { kind: 'invalid', message: `Enter a number from ${min} to ${max}.` };
  }
  return { kind: 'chosen', hundredths };
}

/**
 * Describes a credit amount with its unit.
 *
 * @param hundredths - Credits in hundredths.
 * @returns For example `1 credit` or `3.5 credits`.
 */
function creditsWithUnit(hundredths: number): string {
  return `${formatCredits(hundredths)} ${hundredths === 100 ? 'credit' : 'credits'}`;
}

/**
 * Describes a course's credit rule as the catalog states it.
 *
 * @param rule - The credit rule.
 * @returns For example `3 credits`, or `1 to 3 credits, your choice`.
 */
export function describeCreditRule(rule: CreditRule): string {
  if (rule.kind === CreditRuleKind.Fixed) {
    return creditsWithUnit(rule.creditsHundredths);
  }
  const min = formatCredits(rule.minCreditsHundredths);
  return `${min} to ${creditsWithUnit(rule.maxCreditsHundredths)}, your choice`;
}
