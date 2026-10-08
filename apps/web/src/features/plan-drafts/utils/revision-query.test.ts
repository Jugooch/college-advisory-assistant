/**
 * @file Tests for reading the `revision` query: only an earlier whole revision opens.
 */
import { describe, expect, it } from 'vitest';

import { readRevisionQuery } from './revision-query';

describe('readRevisionQuery', () => {
  it('opens an earlier revision', () => {
    expect(readRevisionQuery('1', 3)).toBe(1);
    expect(readRevisionQuery('2', 3)).toBe(2);
  });

  it.each([
    ['the latest itself', '3'],
    ['a later revision', '4'],
    ['zero', '0'],
    ['a negative number', '-1'],
    ['a fraction', '1.5'],
    ['text', 'abc'],
    ['a path', '../1'],
    ['an empty value', ''],
    ['leading zeros', '01'],
  ])('shows the latest for %s', (_name, value) => {
    expect(readRevisionQuery(value, 3)).toBeNull();
  });

  it('shows the latest when the value is missing or repeated', () => {
    expect(readRevisionQuery(undefined, 3)).toBeNull();
    expect(readRevisionQuery(['1', '2'], 3)).toBeNull();
  });
});
