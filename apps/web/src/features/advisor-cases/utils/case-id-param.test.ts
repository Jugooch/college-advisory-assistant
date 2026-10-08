/**
 * @file Tests for reading a case ID from a route parameter.
 */
import { describe, expect, it } from 'vitest';

import { syntheticId } from '@caa/test-kit';

import { readCaseIdParam } from './case-id-param';

describe('readCaseIdParam', () => {
  it('returns a valid case ID', () => {
    const id = syntheticId('advisingCase', 1);

    expect(readCaseIdParam(id)).toBe(id);
  });

  it.each(['..', '', 'not-an-id', '../students'])('returns null for %j', (value) => {
    expect(readCaseIdParam(value)).toBeNull();
  });
});
