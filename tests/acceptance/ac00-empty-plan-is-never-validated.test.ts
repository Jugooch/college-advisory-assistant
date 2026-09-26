/**
 * @file Acceptance: a plan with no evidence must never be reported as validated.
 * @requirement FR-09
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { AggregateState } from '@caa/domain';
import { aggregateCheckStates } from '@caa/engine';
import { buildCheckResult } from '@caa/test-kit';
import { describe, expect, it } from 'vitest';

describe('AC00 empty plans are never validated', () => {
  it('reports NEEDS_VERIFICATION for zero checks', () => {
    expect(aggregateCheckStates([])).toBe(AggregateState.NeedsVerification);
  });

  it('reports VALIDATED for a single built passing check', () => {
    const check = buildCheckResult();

    expect(aggregateCheckStates([check.state])).toBe(AggregateState.Validated);
  });
});
