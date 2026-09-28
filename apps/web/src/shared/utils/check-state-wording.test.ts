/**
 * @file Tests for check-state and aggregate wording.
 */
import { describe, expect, it } from 'vitest';

import { AggregateState, CheckState } from '@caa/domain';

import { describeAggregate, describeCheckState } from './check-state-wording';

const AS_OF = 'Sep 12, 2026, 2:00 PM UTC (record) and Sep 10, 2026, 9:00 AM UTC (audit)';

describe('describeCheckState', () => {
  it.each([
    [CheckState.Pass, `Passed as of ${AS_OF}`, 'positive'],
    [CheckState.Fail, 'Not met', 'negative'],
    [CheckState.Unknown, 'Needs verification', 'caution'],
    [CheckState.Conditional, 'Conditional', 'caution'],
  ])('shows %s as "%s" with a %s tone', (state, label, tone) => {
    expect(describeCheckState(state, AS_OF)).toEqual({ label, tone });
  });
});

describe('describeAggregate', () => {
  it.each([
    [AggregateState.Blocked, 'Blocked', 'negative'],
    [AggregateState.NeedsVerification, 'Needs verification', 'caution'],
    [AggregateState.Conditional, 'Conditional', 'caution'],
    [AggregateState.Validated, 'Validated for the listed checks only', 'neutral'],
  ])('shows %s as "%s" with a %s tone', (aggregate, label, tone) => {
    expect(describeAggregate(aggregate)).toMatchObject({ label, tone });
  });

  it.each(Object.values(AggregateState))(
    'never shows %s as approved, eligible, or registered',
    (aggregate) => {
      const { label, explanation } = describeAggregate(aggregate);

      expect(`${label} ${explanation}`).not.toMatch(/approved|eligible|registered/i);
    },
  );
});
