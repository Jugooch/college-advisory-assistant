/**
 * @file Tests for the repeat policy enum.
 */
import { describe, expect, it } from 'vitest';

import { RepeatPolicy, RepeatPolicySchema } from './repeat-policy.enum';

describe('RepeatPolicySchema', () => {
  it('accepts every registered repeat policy', () => {
    expect(Object.values(RepeatPolicy).map((policy) => RepeatPolicySchema.parse(policy))).toEqual([
      'MOST_RECENT',
      'HIGHEST_GRADE',
    ]);
  });

  it('rejects a policy outside the registry', () => {
    expect(RepeatPolicySchema.safeParse('FIRST_ATTEMPT').success).toBe(false);
  });
});
