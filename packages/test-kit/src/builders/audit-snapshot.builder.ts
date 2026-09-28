/**
 * @file Builds synthetic degree-audit snapshots for tests.
 * @module @caa/test-kit/builders/audit-snapshot
 */
import { type AuditSnapshot, type AuditSnapshotInput, createAuditSnapshot } from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';
import { buildRequirementResult } from './requirement-result.builder';

/**
 * Builds a valid audit snapshot for student seed 1 in program seed 1, tenant A, pinned to student
 * snapshot seed 1.
 *
 * Defaults: source `demo-audit`, catalog year `2025-2026`, generated 2026-09-20 08:00 against a
 * student record effective 30 minutes earlier, and one requirement from
 * `buildRequirementResult()`.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes snapshots; drives the default `id` and `auditVersion`, for example
 *   `audit_demo_r1`.
 * @returns A validated audit snapshot.
 */
export function buildAuditSnapshot(
  overrides: Partial<AuditSnapshotInput> = {},
  seed = 1,
): AuditSnapshot {
  return createAuditSnapshot({
    id: syntheticId('audit', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    studentId: syntheticId('student', 1),
    studentSnapshotId: syntheticId('studentSnapshot', 1),
    programId: syntheticId('program', 1),
    auditSource: 'demo-audit',
    auditVersion: `audit_demo_r${String(seed)}`,
    catalogYear: '2025-2026',
    generatedAt: '2026-09-20T08:00:00.000-05:00',
    studentRecordEffectiveAt: '2026-09-20T07:30:00.000-05:00',
    requirements: [buildRequirementResult()],
    ...overrides,
  });
}
