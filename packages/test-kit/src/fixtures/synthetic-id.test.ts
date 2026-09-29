/**
 * @file Tests for deterministic synthetic IDs.
 */
import { describe, expect, it } from 'vitest';

import { syntheticId, syntheticSourceStudentId } from './synthetic-id';

describe('syntheticId', () => {
  it('derives the ID from the kind prefix and the seed in hex', () => {
    expect(syntheticId('tenant', 1)).toBe('10000000-0000-4000-8000-000000000001');
    expect(syntheticId('user', 255)).toBe('20000000-0000-4000-8000-0000000000ff');
    expect(syntheticId('student', 0)).toBe('30000000-0000-4000-8000-000000000000');
    expect(syntheticId('assignment', 0xffff_ffff_ffff)).toBe(
      '40000000-0000-4000-8000-ffffffffffff',
    );
  });

  it('gives each S2 kind its own prefix', () => {
    expect(syntheticId('course', 1)).toBe('50000000-0000-4000-8000-000000000001');
    expect(syntheticId('attempt', 1)).toBe('60000000-0000-4000-8000-000000000001');
    expect(syntheticId('audit', 1)).toBe('70000000-0000-4000-8000-000000000001');
    expect(syntheticId('program', 1)).toBe('80000000-0000-4000-8000-000000000001');
    expect(syntheticId('equivalencyGroup', 1)).toBe('90000000-0000-4000-8000-000000000001');
  });

  it('gives the S3 student snapshot and term kinds their own prefixes', () => {
    expect(syntheticId('studentSnapshot', 1)).toBe('a0000000-0000-4000-8000-000000000001');
    expect(syntheticId('term', 1)).toBe('b0000000-0000-4000-8000-000000000001');
  });

  it('rejects a seed that is negative, fractional, or too large for the final group', () => {
    expect(() => syntheticId('user', -1)).toThrow(RangeError);
    expect(() => syntheticId('user', 1.5)).toThrow(RangeError);
    expect(() => syntheticId('user', 0x1_0000_0000_0000)).toThrow(RangeError);
  });
});

describe('syntheticSourceStudentId', () => {
  it('pads the seed to six digits after the SYN- prefix', () => {
    expect(syntheticSourceStudentId(1)).toBe('SYN-000001');
    expect(syntheticSourceStudentId(1234567)).toBe('SYN-1234567');
  });

  it('rejects a seed that is negative or fractional', () => {
    expect(() => syntheticSourceStudentId(-1)).toThrow(RangeError);
    expect(() => syntheticSourceStudentId(0.5)).toThrow(RangeError);
  });
});
