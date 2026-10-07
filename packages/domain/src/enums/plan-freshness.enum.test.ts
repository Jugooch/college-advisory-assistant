/**
 * @file Tests for the plan freshness and stale reason vocabulary.
 */
import { describe, expect, it } from 'vitest';

import {
  PlanFreshness,
  PlanFreshnessSchema,
  PlanStaleReason,
  PlanStaleReasonSchema,
} from './plan-freshness.enum';

describe('plan freshness vocabulary', () => {
  it('lists the fixed states and reasons', () => {
    expect(Object.values(PlanFreshness)).toEqual(['CURRENT', 'STALE', 'UNKNOWN']);
    expect(Object.values(PlanStaleReason)).toEqual([
      'STUDENT_RECORD_SUPERSEDED',
      'AUDIT_SUPERSEDED',
      'SECTIONS_SUPERSEDED',
      'RULESET_CHANGED',
      'TRANSITION_TABLE_CHANGED',
      'SOURCE_EXPIRED',
      'SOURCE_UNAVAILABLE',
    ]);
  });

  it('rejects values outside the vocabulary', () => {
    expect(PlanFreshnessSchema.safeParse('FRESH').success).toBe(false);
    expect(PlanStaleReasonSchema.safeParse('STALE').success).toBe(false);
  });
});
