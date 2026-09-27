/**
 * @file Tests for the synthetic audit snapshot builder.
 */
import { describe, expect, it } from 'vitest';

import { AuditSnapshotSchema } from '@caa/domain';

import { buildAuditSnapshot } from './audit-snapshot.builder';
import { buildRequirementResult } from './requirement-result.builder';

describe('buildAuditSnapshot', () => {
  it('defaults to one incomplete requirement for student 1 in program 1', () => {
    expect(buildAuditSnapshot()).toEqual({
      id: '70000000-0000-4000-8000-000000000001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      studentId: '30000000-0000-4000-8000-000000000001',
      programId: '80000000-0000-4000-8000-000000000001',
      auditSource: 'demo-audit',
      auditVersion: 'audit_demo_r1',
      catalogYear: '2025-2026',
      generatedAt: '2026-09-20T08:00:00.000-05:00',
      studentRecordEffectiveAt: '2026-09-20T07:30:00.000-05:00',
      requirements: [
        {
          sourceRequirementId: 'REQ-001',
          parentSourceRequirementId: null,
          label: 'Mathematics core',
          state: 'INCOMPLETE',
          allocatedAttemptIds: [],
          remainingCreditsHundredths: 300,
          remainingCourseCount: 1,
          candidateCourseIds: ['50000000-0000-4000-8000-000000000102'],
          isReusable: false,
          sourceRef: 'demo-audit/REQ-001',
        },
      ],
    });
  });

  it('returns deep-equal snapshots for the same arguments', () => {
    expect(buildAuditSnapshot({}, 7)).toEqual(buildAuditSnapshot({}, 7));
  });

  it('derives the id and auditVersion from the seed', () => {
    const snapshot = buildAuditSnapshot({}, 7);

    expect(snapshot.id).toBe('70000000-0000-4000-8000-000000000007');
    expect(snapshot.auditVersion).toBe('audit_demo_r7');
  });

  it('applies overrides', () => {
    const snapshot = buildAuditSnapshot({
      catalogYear: '2024-2025',
      requirements: [
        buildRequirementResult({}, 1),
        buildRequirementResult({ parentSourceRequirementId: 'REQ-001' }, 2),
      ],
    });

    expect(snapshot.catalogYear).toBe('2024-2025');
    expect(snapshot.requirements.map((result) => result.sourceRequirementId)).toEqual([
      'REQ-001',
      'REQ-002',
    ]);
  });

  it('returns a snapshot that passes the domain schema', () => {
    expect(AuditSnapshotSchema.safeParse(buildAuditSnapshot()).success).toBe(true);
  });

  it('rejects a snapshot whose record is later than its generation time', () => {
    expect(() =>
      buildAuditSnapshot({ studentRecordEffectiveAt: '2026-09-20T09:00:00.000-05:00' }),
    ).toThrow();
  });
});
