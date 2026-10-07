/**
 * @file Tests for the plan revision data object.
 */
import { describe, expect, it } from 'vitest';

import { createPlanRevision, PlanRevisionSchema } from './plan-revision.model';

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
  studentRecordEffectiveAt: '2026-10-06T08:00:00.000-05:00',
  auditRecordEffectiveAt: '2026-10-06T08:00:00.000-05:00',
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

  it('rejects pinned record times without an offset or missing', () => {
    expect(accepts({ studentRecordEffectiveAt: '2026-10-06T08:00:00' })).toBe(false);
    expect(accepts({ auditRecordEffectiveAt: '2026-10-06T08:00:00' })).toBe(false);
    expect(accepts({ studentRecordEffectiveAt: undefined })).toBe(false);
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

  it('rejects two credit values for one course', () => {
    const courseId = 'c0000000-0000-4000-8000-000000000001';
    expect(
      accepts({
        creditSelections: [
          { courseId, selectedCreditsHundredths: 300 },
          { courseId, selectedCreditsHundredths: 400 },
        ],
      }),
    ).toBe(false);
  });

  it('rejects a credit value for a course not in the plan', () => {
    expect(
      accepts({
        creditSelections: [
          { courseId: 'c0000000-0000-4000-8000-000000000009', selectedCreditsHundredths: 300 },
        ],
      }),
    ).toBe(false);
  });

  it('accepts exactly 8 courses and rejects 9', () => {
    const courses = (count: number): string[] =>
      Array.from(
        { length: count },
        (_, index) => `c0000000-0000-4000-8000-00000000010${String(index)}`,
      );
    expect(accepts({ courseIds: courses(8), creditSelections: [] })).toBe(true);
    expect(accepts({ courseIds: courses(9), creditSelections: [] })).toBe(false);
  });

  it('accepts 64 sections and rejects 65', () => {
    const sections = (count: number): string[] =>
      Array.from(
        { length: count },
        (_, index) => `5a000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`,
      );
    expect(accepts({ selectedSectionIds: sections(64) })).toBe(true);
    expect(accepts({ selectedSectionIds: sections(65) })).toBe(false);
  });

  it('accepts a work cap of 3000000 and rejects 3000001 or 0', () => {
    expect(accepts({ solverWorkCap: 3_000_000 })).toBe(true);
    expect(accepts({ solverWorkCap: 3_000_001 })).toBe(false);
    expect(accepts({ solverWorkCap: 0 })).toBe(false);
  });
});

describe('createPlanRevision', () => {
  it('returns the parsed revision and throws on invalid input', () => {
    expect(createPlanRevision(VALID as never).revision).toBe(1);
    expect(() => createPlanRevision({ ...VALID, revision: 0 } as never)).toThrow();
  });
});
