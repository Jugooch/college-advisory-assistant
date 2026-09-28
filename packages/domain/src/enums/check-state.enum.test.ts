/**
 * @file Tests for the check and aggregate state enums and the aggregate precedence.
 */
import { describe, expect, it } from 'vitest';

import { AggregateStateSchema, CheckStateSchema, deriveAggregateState } from './check-state.enum';

describe('CheckStateSchema and AggregateStateSchema', () => {
  it('reject a state outside the registry', () => {
    expect(CheckStateSchema.safeParse('PROBABLY').success).toBe(false);
    expect(AggregateStateSchema.safeParse('PASS').success).toBe(false);
  });
});

describe('deriveAggregateState', () => {
  it('is NEEDS_VERIFICATION for no checks, never VALIDATED', () => {
    expect(deriveAggregateState([])).toBe('NEEDS_VERIFICATION');
  });

  it('is BLOCKED when any check fails, whatever else is present', () => {
    expect(deriveAggregateState(['PASS', 'CONDITIONAL', 'UNKNOWN', 'FAIL'])).toBe('BLOCKED');
  });

  it('is NEEDS_VERIFICATION for an UNKNOWN beside a CONDITIONAL and no FAIL', () => {
    expect(deriveAggregateState(['CONDITIONAL', 'UNKNOWN', 'PASS'])).toBe('NEEDS_VERIFICATION');
  });

  it('is CONDITIONAL for a CONDITIONAL beside PASS checks', () => {
    expect(deriveAggregateState(['PASS', 'CONDITIONAL'])).toBe('CONDITIONAL');
  });

  it('is VALIDATED only when every check passes', () => {
    expect(deriveAggregateState(['PASS', 'PASS'])).toBe('VALIDATED');
  });
});
