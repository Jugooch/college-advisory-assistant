/**
 * @file One factory per invoked check, filling in the check kind, source versions, and review
 *   fields so each case lists only its own facts.
 * @module @caa/test-kit/golden/golden-case-factories
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckKind } from '@caa/domain';

import { defineGoldenCase, type GoldenCase, type GoldenCaseInput } from './golden-case.schema';
import {
  AUDIT_SOURCES,
  CREDIT_LOAD_SOURCES,
  GOLDEN_REVIEW,
  PREREQUISITE_SOURCES,
} from './golden-inputs';

/** Input of a case with a given check, as the schema accepts it. */
type CaseOf<K extends GoldenCaseInput['check']> = Extract<GoldenCaseInput, { check: K }>;

/**
 * Fields a case author writes; the factory fills in the rest. `adjudicatedOn` defaults to the v0
 * date; a case written or adjudicated again later states its own.
 */
type AuthoredCase<K extends GoldenCaseInput['check']> = Omit<
  CaseOf<K>,
  'check' | 'sourceVersions' | 'reviewer' | 'adjudicatedOn' | 'allowedAlternatives'
> &
  Partial<Pick<CaseOf<K>, 'allowedAlternatives' | 'sourceVersions' | 'adjudicatedOn'>>;

/**
 * Defines a case that evaluates a prerequisite rule.
 *
 * @param authored - The case's own fields.
 * @returns The validated case.
 */
export function prerequisiteCase(authored: AuthoredCase<'PREREQUISITE'>): GoldenCase {
  return defineGoldenCase({
    allowedAlternatives: [],
    sourceVersions: [...PREREQUISITE_SOURCES],
    ...GOLDEN_REVIEW,
    ...authored,
    check: CheckKind.Prerequisite,
  });
}

/**
 * Defines a case that evaluates requirement applicability.
 *
 * @param authored - The case's own fields.
 * @returns The validated case.
 */
export function applicabilityCase(authored: AuthoredCase<'REQUIREMENT_APPLICABILITY'>): GoldenCase {
  return defineGoldenCase({
    allowedAlternatives: [],
    sourceVersions: [...AUDIT_SOURCES],
    ...GOLDEN_REVIEW,
    ...authored,
    check: CheckKind.RequirementApplicability,
  });
}

/**
 * Defines a case that checks candidate-set allocation.
 *
 * @param authored - The case's own fields.
 * @returns The validated case.
 */
export function allocationCase(authored: AuthoredCase<'REQUIREMENT_ALLOCATION'>): GoldenCase {
  return defineGoldenCase({
    allowedAlternatives: [],
    sourceVersions: [...AUDIT_SOURCES],
    ...GOLDEN_REVIEW,
    ...authored,
    check: CheckKind.RequirementAllocation,
  });
}

/**
 * Defines a case that checks a candidate set's credit load.
 *
 * @param authored - The case's own fields.
 * @returns The validated case.
 */
export function creditLoadCase(authored: AuthoredCase<'CREDIT_LOAD'>): GoldenCase {
  return defineGoldenCase({
    allowedAlternatives: [],
    sourceVersions: [...CREDIT_LOAD_SOURCES],
    ...GOLDEN_REVIEW,
    ...authored,
    check: CheckKind.CreditLoad,
  });
}
