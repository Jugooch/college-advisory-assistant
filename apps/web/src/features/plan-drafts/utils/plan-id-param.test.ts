/**
 * @file Tests for reading the plan ID route param.
 */
import { describe, expect, it } from 'vitest';

import { syntheticId } from '@caa/test-kit';

import { readPlanIdParam } from './plan-id-param';

describe('readPlanIdParam', () => {
  it('returns a valid plan ID', () => {
    expect(readPlanIdParam(syntheticId('plan', 1))).toBe(syntheticId('plan', 1));
  });

  it.each(['..', 'abc', '', '../students', syntheticId('plan', 1) + '/x'])(
    'returns null for %j',
    (value) => {
      expect(readPlanIdParam(value)).toBeNull();
    },
  );
});
