/**
 * @file Tests for the plan and plan revision data objects.
 */
import { describe, expect, it } from 'vitest';

import { PlanFreshness, PlanStaleReason } from '../enums/plan-freshness.enum';
import { PlanSchema } from './plan.model';
import { PlanRevisionSchema } from './plan-revision.model';

const SECTION_A = '5a000000-0000-4000-8000-000000000001';
const SECTION_B = '5a000000-0000-4000-8000-000000000002';

const VALID = {
  id: '7a000000-0000-4000-8000-000000000001',
  planId: '7b000000-0000-4000-8000-000000000001',
  revision: 1,
  cause: 'SAVED',
  createdBy: '1a2b3c4d-0000-4000-8000-000000000002',
  createdAt: '2026-10-07T09:00:00.000-05:00',
  termId: '3a000000-0000-4000-8000-000000000001',
  courseIds: ['c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002'],
  creditSelections: [
    { courseId: 'c0000000-0000-4000-8000-000000000001', selectedCreditsHundredths: 300 },
  ],
  constraints: [],
  studentSnapshotId: '4a000000-0000-4000-8000-000000000001',
  auditSnapshotId: '4b000000-0000-4000-8000-000000000001',
  auditSource: 'demo-audit',
  auditVersion: 'audit_demo_r7',
  rulesetVersion: 'demo-2026.1',
  sectionSnapshotId: '4c000000-0000-4000-8000-000000000001',
  campusTransitionVersion: null,
  solverWorkCap: 3_000_000,
  constraintHash: `sha256:${'0a'.repeat(32)}`,
  outcome: 'OPTIONS_FOUND',
  selectedSectionIds: [SECTION_A, SECTION_B],
};

const accepts = (overrides: Record<string, unknown>): boolean =>
  PlanRevisionSchema.safeParse({ ...VALID, ...overrides }).success;

describe('PlanRevisionSchema', () => {
  it('accepts a saved revision with a chosen section set', () => {
    expect(accepts({})).toBe(true);
  });

  it('accepts a null selection for every outcome except OPTIONS_FOUND', () => {
    for (const outcome of ['NO_FEASIBLE_PLAN', 'SEARCH_TIMEOUT', 'NEEDS_VERIFICATION']) {
      expect(accepts({ outcome, selectedSectionIds: null })).toBe(true);
    }
  });

  it('rejects a selection when the outcome is not OPTIONS_FOUND', () => {
    expect(accepts({ outcome: 'NO_FEASIBLE_PLAN' })).toBe(false);
  });

  it('rejects a missing selection on OPTIONS_FOUND', () => {
    expect(accepts({ selectedSectionIds: null })).toBe(false);
  });

  it('rejects an unsorted or repeated section set', () => {
    expect(accepts({ selectedSectionIds: [SECTION_B, SECTION_A] })).toBe(false);
    expect(accepts({ selectedSectionIds: [SECTION_A, SECTION_A] })).toBe(false);
  });

  it('rejects revision 0', () => {
    expect(accepts({ revision: 0 })).toBe(false);
  });

  it('rejects a time without an offset', () => {
    expect(accepts({ createdAt: '2026-10-07T09:00:00' })).toBe(false);
  });

  it('rejects repeated courses and an out-of-range course count', () => {
    const course = 'c0000000-0000-4000-8000-000000000001';
    expect(accepts({ courseIds: [course, course] })).toBe(false);
    expect(accepts({ courseIds: [] })).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(accepts({ tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f' })).toBe(false);
  });

  it('rejects a malformed constraint hash', () => {
    expect(accepts({ constraintHash: 'abc' })).toBe(false);
  });
});

describe('PlanSchema', () => {
  const PLAN = {
    id: '7b000000-0000-4000-8000-000000000001',
    tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
    studentId: '2b3c4d5e-0000-4000-8000-000000000001',
    termId: '3a000000-0000-4000-8000-000000000001',
    createdAt: '2026-10-07T09:00:00.000-05:00',
  };

  it('accepts a plan and rejects unknown keys or a time without offset', () => {
    expect(PlanSchema.safeParse(PLAN).success).toBe(true);
    expect(PlanSchema.safeParse({ ...PLAN, extra: 1 }).success).toBe(false);
    expect(PlanSchema.safeParse({ ...PLAN, createdAt: '2026-10-07T09:00:00' }).success).toBe(false);
  });
});

describe('staleness vocabulary', () => {
  it('lists the fixed freshness states and reasons', () => {
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
});
