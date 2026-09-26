/**
 * @file Tests for aggregate check state precedence.
 */
import { describe, expect, it } from 'vitest';

import { AggregateState, CheckState } from '@caa/domain';

import { aggregateCheckStates } from './aggregate-check-states';

describe('aggregateCheckStates', () => {
  it('returns NEEDS_VERIFICATION when there are no checks', () => {
    expect(aggregateCheckStates([])).toBe(AggregateState.NeedsVerification);
  });

  it('returns BLOCKED when any check fails, even alongside UNKNOWN', () => {
    const states = [CheckState.Pass, CheckState.Unknown, CheckState.Fail];

    expect(aggregateCheckStates(states)).toBe(AggregateState.Blocked);
  });

  it('returns NEEDS_VERIFICATION when a check is UNKNOWN and none fail', () => {
    const states = [CheckState.Conditional, CheckState.Unknown];

    expect(aggregateCheckStates(states)).toBe(AggregateState.NeedsVerification);
  });

  it('returns CONDITIONAL when the only non-pass state is CONDITIONAL', () => {
    const states = [CheckState.Pass, CheckState.Conditional];

    expect(aggregateCheckStates(states)).toBe(AggregateState.Conditional);
  });

  it('returns VALIDATED only when every check passes', () => {
    expect(aggregateCheckStates([CheckState.Pass, CheckState.Pass])).toBe(AggregateState.Validated);
  });
});
