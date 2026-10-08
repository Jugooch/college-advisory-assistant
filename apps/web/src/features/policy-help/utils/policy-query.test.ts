/**
 * @file Tests for reading the policy search text.
 */
import { describe, expect, it } from 'vitest';

import { readPolicyQuery } from './policy-query';

describe('readPolicyQuery', () => {
  it('treats a missing or blank value as no search', () => {
    expect(readPolicyQuery(undefined)).toEqual({ kind: 'none' });
    expect(readPolicyQuery('   ')).toEqual({ kind: 'none' });
  });

  it('trims valid text', () => {
    expect(readPolicyQuery('  late drop ')).toEqual({ kind: 'valid', text: 'late drop' });
  });

  it('refuses a repeated value and text over 200 characters', () => {
    expect(readPolicyQuery(['a', 'b'])).toEqual({ kind: 'invalid' });
    expect(readPolicyQuery('x'.repeat(201))).toEqual({ kind: 'invalid' });
  });
});
