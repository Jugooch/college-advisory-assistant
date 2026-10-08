/**
 * @file Tests for reading the `planId` query parameter.
 */
import { describe, expect, it } from 'vitest';

import { syntheticId } from '@caa/test-kit';

import { readPlanIdQuery } from './plan-id-query';

describe('readPlanIdQuery', () => {
  it('returns a valid plan ID, trimmed', () => {
    const planId = syntheticId('plan', 1);

    expect(readPlanIdQuery(` ${planId} `)).toBe(planId);
  });

  it.each([undefined, '', '  ', '..', 'not-a-uuid', ['a', 'b']])('returns null for %j', (value) => {
    expect(readPlanIdQuery(value)).toBeNull();
  });
});
