/**
 * @file Tests for the plan revision row mapper.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type { PlanRevisionRow } from '../tables/plan-revision.table';
import { toStoredPlanRevision } from './plan-revision.mapper';

const COURSE_ID = '2b3c4d5e-6f70-4a81-92a3-b4c5d6e7f809';
const SECTION_ID = '3c4d5e6f-7081-4b92-a3b4-c5d6e7f80910';

const ROW: PlanRevisionRow = {
  id: '9f4e5d6c-7b8a-4f9e-a0d1-3c4d5e6f7081',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  planId: '4d5e6f70-8192-4ca3-b4c5-d6e7f8091021',
  studentId: '7e2d3c4b-5a6f-4e7d-9c8b-2b3c4d5e6f70',
  termId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  revision: 2,
  cause: 'REVALIDATED',
  createdBy: '5d1c2b3a-4f5e-4d6c-8b7a-1a2b3c4d5e6f',
  createdAt: new Date('2026-10-02T15:00:00.000Z'),
  courseIds: [COURSE_ID],
  creditSelections: [{ courseId: COURSE_ID, selectedCreditsHundredths: 300 }],
  constraints: [],
  studentSnapshotId: '5e6f7081-92a3-4db4-85d6-e7f809102132',
  studentRecordEffectiveAt: new Date('2026-09-10T06:00:00.000Z'),
  auditSnapshotId: '6f708192-a3b4-4ec5-96e7-f80910213243',
  auditRecordEffectiveAt: new Date('2026-09-11T06:00:00.000Z'),
  auditSource: 'demo-audit',
  auditVersion: 'audit_demo_r1',
  rulesetVersion: 'demo-ruleset-1',
  sectionSnapshotId: '708192a3-b4c5-4fd6-a7f8-091021324354',
  campusTransitionVersion: null,
  solverWorkCap: 3_000_000,
  constraintHash: `sha256:${'b'.repeat(64)}`,
  outcome: 'OPTIONS_FOUND',
  selectedSectionIds: [SECTION_ID],
  result: { options: [{ anything: 'opaque' }] },
};

describe('toStoredPlanRevision', () => {
  it('maps the row to a domain revision with ISO timestamps', () => {
    const { revision } = toStoredPlanRevision(ROW);

    expect(revision).toMatchObject({
      id: ROW.id,
      planId: ROW.planId,
      revision: 2,
      cause: 'REVALIDATED',
      createdAt: '2026-10-02T15:00:00.000Z',
      studentRecordEffectiveAt: '2026-09-10T06:00:00.000Z',
      auditRecordEffectiveAt: '2026-09-11T06:00:00.000Z',
      selectedSectionIds: [SECTION_ID],
    });
    expect(revision).not.toHaveProperty('result');
  });

  it('returns the result untouched as opaque JSON', () => {
    expect(toStoredPlanRevision(ROW).result).toBe(ROW.result);
  });

  it('keeps a null selection for an outcome without options', () => {
    const { revision } = toStoredPlanRevision({
      ...ROW,
      outcome: 'NO_FEASIBLE_PLAN',
      selectedSectionIds: null,
    });

    expect(revision.selectedSectionIds).toBeNull();
  });

  it('rejects a selection that contradicts the outcome', () => {
    expect(() => toStoredPlanRevision({ ...ROW, outcome: 'SEARCH_TIMEOUT' })).toThrow(ZodError);
  });

  it('rejects stored constraints that do not parse', () => {
    expect(() => toStoredPlanRevision({ ...ROW, constraints: [{ kind: 'BOGUS' }] })).toThrow(
      ZodError,
    );
  });
});
