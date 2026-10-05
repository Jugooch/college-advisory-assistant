/**
 * @file Tests for the section tie-break key: sorted by code unit, with a proper prefix first.
 */
import { describe, expect, it } from 'vitest';

import type { SectionId } from '@caa/domain';

import { compareText, tieBreakKeyOf } from './tie-break-key';

const A = 'c0000000-0000-4000-8000-00000000000a' as SectionId;
const B = 'c0000000-0000-4000-8000-00000000000b' as SectionId;
const C = 'c0000000-0000-4000-8000-00000000000c' as SectionId;

describe('tieBreakKeyOf', () => {
  it('gives the same key for the same sections in any order', () => {
    expect(tieBreakKeyOf([C, A, B])).toBe(tieBreakKeyOf([A, B, C]));
  });

  it('orders a proper prefix first', () => {
    expect(compareText(tieBreakKeyOf([A]), tieBreakKeyOf([A, B]))).toBe(-1);
  });

  it('orders by the first differing section', () => {
    expect(compareText(tieBreakKeyOf([A, C]), tieBreakKeyOf([B]))).toBe(-1);
    expect(compareText(tieBreakKeyOf([B]), tieBreakKeyOf([A, C]))).toBe(1);
  });

  it('compares equal text as zero', () => {
    expect(compareText(A, A)).toBe(0);
  });
});
