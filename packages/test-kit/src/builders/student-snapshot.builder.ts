/**
 * @file Builds synthetic student snapshots (pinned student record revisions) for tests.
 * @module @caa/test-kit/builders/student-snapshot
 */
import {
  createStudentSnapshot,
  type StudentSnapshot,
  type StudentSnapshotInput,
} from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';

/**
 * Builds a valid student snapshot for student seed 1 in program seed 1, tenant A, catalog
 * `2025-2026`, listing no attempts.
 *
 * The default matches what `buildAuditSnapshot()` ran against: snapshot seed 1, with a source
 * time of 2026-09-20 07:30 -05:00, the audit's `studentRecordEffectiveAt`. It was ingested 15
 * minutes later. Override `attemptIds` with the IDs of the attempts a case lists.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes snapshots; drives the default `id`.
 * @returns A validated student snapshot.
 */
export function buildStudentSnapshot(
  overrides: Partial<StudentSnapshotInput> = {},
  seed = 1,
): StudentSnapshot {
  return createStudentSnapshot({
    id: syntheticId('studentSnapshot', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    studentId: syntheticId('student', 1),
    programId: syntheticId('program', 1),
    catalogYear: '2025-2026',
    attemptIds: [],
    sourceEffectiveAt: '2026-09-20T07:30:00.000-05:00',
    ingestedAt: '2026-09-20T07:45:00.000-05:00',
    ...overrides,
  });
}
