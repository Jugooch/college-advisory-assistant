/**
 * @file Tests for the shared case reason invariants.
 */
import { describe, expect, it } from 'vitest';

import { isCasePlanSatisfied, isCaseSubjectConsistent } from './case-reason.enum';

describe('isCaseSubjectConsistent', () => {
  it('requires a subject exactly for SOURCE_DISCREPANCY', () => {
    expect(isCaseSubjectConsistent('SOURCE_DISCREPANCY', true)).toBe(true);
    expect(isCaseSubjectConsistent('SOURCE_DISCREPANCY', false)).toBe(false);
    expect(isCaseSubjectConsistent('PLAN_REVIEW', true)).toBe(false);
    expect(isCaseSubjectConsistent('NEEDS_VERIFICATION', false)).toBe(true);
  });
});

describe('isCasePlanSatisfied', () => {
  it('requires a plan for every reason except SOURCE_DISCREPANCY', () => {
    expect(isCasePlanSatisfied('PLAN_REVIEW', false)).toBe(false);
    expect(isCasePlanSatisfied('NEEDS_VERIFICATION', true)).toBe(true);
    expect(isCasePlanSatisfied('SOURCE_DISCREPANCY', false)).toBe(true);
  });
});
