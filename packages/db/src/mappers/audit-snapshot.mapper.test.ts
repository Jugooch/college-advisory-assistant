/**
 * @file Tests for the audit snapshot row mapper.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { RequirementState } from '@caa/domain';

import type { AuditSnapshotRow } from '../tables/audit-snapshot.table';
import type { RequirementResultRow } from '../tables/requirement-result.table';
import { toAuditSnapshot } from './audit-snapshot.mapper';

const ROW: AuditSnapshotRow = {
  id: 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7081',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  studentId: '7e2d3c4b-5a6f-4e7d-9c8b-2b3c4d5e6f70',
  studentSnapshotId: 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f',
  programId: '1f2e3d4c-5b6a-4978-8a1b-2c3d4e5f6a7b',
  auditSource: 'demo-audit',
  auditVersion: 'audit_demo_r7',
  catalogYear: '2025-2026',
  generatedAt: new Date('2026-09-25T08:00:00.000Z'),
  studentRecordEffectiveAt: new Date('2026-09-25T06:00:00.000Z'),
  ingestedAt: new Date('2026-09-25T09:00:00.000Z'),
};

/**
 * Builds a requirement row for one position of the synthetic audit.
 *
 * @param position - Position in the audit.
 * @param ids - The requirement's ID and its parent's ID, or null for a top-level one.
 * @returns The row.
 */
function requirementRow(
  position: number,
  ids: { readonly id: string; readonly parent: string | null },
): RequirementResultRow {
  return {
    id: `f6a7b8c9-d0e1-4f2a-8b3c-4d5e6f70819${String(position)}`,
    tenantId: ROW.tenantId,
    auditSnapshotId: ROW.id,
    position,
    sourceRequirementId: ids.id,
    parentSourceRequirementId: ids.parent,
    label: `Requirement ${ids.id}`,
    state: RequirementState.Incomplete,
    allocatedAttemptIds: [],
    remainingCreditsHundredths: null,
    remainingCourseCount: 1,
    candidateCourseIds: [],
    isReusable: false,
    sourceRef: `demo-audit:${ids.id}`,
  };
}

describe('toAuditSnapshot', () => {
  it('rebuilds the audit with its requirements in position order', () => {
    const audit = toAuditSnapshot(ROW, [
      requirementRow(0, { id: 'REQ-CORE', parent: null }),
      requirementRow(1, { id: 'REQ-MATH', parent: 'REQ-CORE' }),
    ]);

    expect(audit.studentSnapshotId).toBe('c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f');
    expect(audit.generatedAt).toBe('2026-09-25T08:00:00.000Z');
    expect(audit.studentRecordEffectiveAt).toBe('2026-09-25T06:00:00.000Z');
    expect(audit.requirements.map((result) => result.sourceRequirementId)).toEqual([
      'REQ-CORE',
      'REQ-MATH',
    ]);
  });

  it('rejects stored requirements whose parents form a cycle', () => {
    const rows = [
      requirementRow(0, { id: 'REQ-A', parent: 'REQ-B' }),
      requirementRow(1, { id: 'REQ-B', parent: 'REQ-A' }),
    ];

    expect(() => toAuditSnapshot(ROW, rows)).toThrow(ZodError);
  });

  it('rejects a stored requirement whose parent is missing', () => {
    const rows = [requirementRow(0, { id: 'REQ-MATH', parent: 'REQ-CORE' })];

    expect(() => toAuditSnapshot(ROW, rows)).toThrow(ZodError);
  });

  it('rejects a stored audit with no requirements', () => {
    expect(() => toAuditSnapshot(ROW, [])).toThrow(ZodError);
  });
});
