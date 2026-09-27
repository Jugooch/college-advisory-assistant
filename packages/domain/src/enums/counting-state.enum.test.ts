/**
 * @file Tests for the counting state enum.
 */
import { describe, expect, it } from 'vitest';

import { CountingState, CountingStateSchema } from './counting-state.enum';

describe('CountingStateSchema', () => {
  it('accepts every registered counting state', () => {
    expect(Object.values(CountingState).map((state) => CountingStateSchema.parse(state))).toEqual([
      'COUNTED',
      'NONE',
      'UNDETERMINED',
    ]);
  });

  it('rejects a state outside the registry', () => {
    expect(CountingStateSchema.safeParse('PASS').success).toBe(false);
  });
});
