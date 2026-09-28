/**
 * @file Tests for timestamp and credit formatting.
 */
import { describe, expect, it } from 'vitest';

import { formatCredits, formatTimestamp } from './format-display';

describe('formatTimestamp', () => {
  it('renders the instant in UTC whatever the offset', () => {
    expect(formatTimestamp('2026-09-12T09:30:00-05:00')).toBe('Sep 12, 2026, 2:30 PM UTC');
  });
});

describe('formatCredits', () => {
  it.each([
    [300, '3'],
    [350, '3.5'],
    [25, '0.25'],
    [0, '0'],
    [1205, '12.05'],
  ])('formats %i hundredths as %s', (hundredths, expected) => {
    expect(formatCredits(hundredths)).toBe(expected);
  });
});
