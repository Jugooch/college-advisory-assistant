/**
 * @file Tests for the plan freshness view: each state and the reasons it allows.
 */
import { describe, expect, it } from 'vitest';

import { PlanFreshnessViewSchema } from './plan-freshness.contract';

const CHECKED_AT = '2026-10-07T09:05:00.000-05:00';

const accepts = (state: string, reasons: readonly string[], checkedAt = CHECKED_AT): boolean =>
  PlanFreshnessViewSchema.safeParse({ state, reasons, checkedAt }).success;

describe('PlanFreshnessViewSchema', () => {
  it('accepts CURRENT with no reasons', () => {
    expect(accepts('CURRENT', [])).toBe(true);
  });

  it('rejects CURRENT with any reason', () => {
    expect(accepts('CURRENT', ['SOURCE_EXPIRED'])).toBe(false);
  });

  it('accepts STALE with one or more proven reasons', () => {
    expect(accepts('STALE', ['AUDIT_SUPERSEDED'])).toBe(true);
    expect(accepts('STALE', ['STUDENT_RECORD_SUPERSEDED', 'SOURCE_EXPIRED'])).toBe(true);
  });

  it('accepts STALE with all six proven reasons and rejects a seventh entry', () => {
    const six = [
      'STUDENT_RECORD_SUPERSEDED',
      'AUDIT_SUPERSEDED',
      'SECTIONS_SUPERSEDED',
      'RULESET_CHANGED',
      'TRANSITION_TABLE_CHANGED',
      'SOURCE_EXPIRED',
    ];

    expect(accepts('STALE', six)).toBe(true);
    expect(accepts('STALE', [...six, 'SOURCE_UNAVAILABLE'])).toBe(false);
  });

  it('rejects STALE with no reasons', () => {
    expect(accepts('STALE', [])).toBe(false);
  });

  it('rejects STALE that claims SOURCE_UNAVAILABLE', () => {
    expect(accepts('STALE', ['SOURCE_UNAVAILABLE'])).toBe(false);
  });

  it('accepts UNKNOWN that lists SOURCE_UNAVAILABLE, with or without proven reasons', () => {
    expect(accepts('UNKNOWN', ['SOURCE_UNAVAILABLE'])).toBe(true);
    expect(accepts('UNKNOWN', ['AUDIT_SUPERSEDED', 'SOURCE_UNAVAILABLE'])).toBe(true);
  });

  it('rejects UNKNOWN with no reasons or without SOURCE_UNAVAILABLE', () => {
    expect(accepts('UNKNOWN', [])).toBe(false);
    expect(accepts('UNKNOWN', ['SOURCE_EXPIRED'])).toBe(false);
  });

  it('rejects a repeated reason', () => {
    expect(accepts('STALE', ['SOURCE_EXPIRED', 'SOURCE_EXPIRED'])).toBe(false);
  });

  it('rejects an unknown state, an unknown reason, and a checkedAt without an offset', () => {
    expect(accepts('FRESH', [])).toBe(false);
    expect(accepts('STALE', ['REGISTERED'])).toBe(false);
    expect(accepts('CURRENT', [], '2026-10-07T09:05:00')).toBe(false);
  });

  it('rejects an extra field', () => {
    expect(
      PlanFreshnessViewSchema.safeParse({
        state: 'CURRENT',
        reasons: [],
        checkedAt: CHECKED_AT,
        approved: true,
      }).success,
    ).toBe(false);
  });
});
