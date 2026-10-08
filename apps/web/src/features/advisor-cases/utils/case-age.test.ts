/**
 * @file Tests for the age wording of queue rows.
 */
import { describe, expect, it } from 'vitest';

import { describeCaseAge } from './case-age';

const NOW = new Date('2026-09-25T12:00:00.000Z');

describe('describeCaseAge', () => {
  it('says less than an hour for a new case', () => {
    expect(describeCaseAge('2026-09-25T11:30:00.000Z', NOW)).toBe('Less than an hour');
  });

  it('counts hours, singular and plural', () => {
    expect(describeCaseAge('2026-09-25T11:00:00.000Z', NOW)).toBe('1 hour');
    expect(describeCaseAge('2026-09-25T07:00:00.000Z', NOW)).toBe('5 hours');
  });

  it('counts days, singular and plural', () => {
    expect(describeCaseAge('2026-09-24T12:00:00.000Z', NOW)).toBe('1 day');
    expect(describeCaseAge('2026-09-22T05:00:00.000-05:00', NOW)).toBe('3 days');
  });

  it('treats a time in the future as new', () => {
    expect(describeCaseAge('2026-09-26T12:00:00.000Z', NOW)).toBe('Less than an hour');
  });
});
