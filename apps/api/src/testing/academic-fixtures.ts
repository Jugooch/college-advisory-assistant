/**
 * @file Synthetic student record and audit snapshots for the academic summary tests.
 * @module @caa/api/testing/academic-fixtures
 * @see docs/standards/07-testing.md
 */
import {
  type AuditSnapshot,
  type AuditSnapshotInput,
  createStudentSnapshot,
  type StudentSnapshot,
  type StudentSnapshotInput,
} from '@caa/domain';
import { buildAuditSnapshot, SYNTHETIC_TENANTS, syntheticId } from '@caa/test-kit';

/** Source, ingestion, and audit times of the default record and audit. ISO 8601 with offset. */
export const RECORD_TIMES = {
  sourceEffectiveAt: '2026-08-31T12:30:00.000Z',
  ingestedAt: '2026-08-31T13:00:00.000Z',
  auditGeneratedAt: '2026-08-31T13:30:00.000Z',
} as const;

/**
 * Builds a student record snapshot for student seed 1 in tenant A, on program seed 1 and
 * catalog `2025-2026`, with no attempts. It matches `buildAuditSnapshot`'s student, program,
 * and catalog, and with seed 1 it is the snapshot that audit ran against.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes snapshots; drives the default `id`.
 * @returns A validated student snapshot.
 */
export function buildRecordSnapshot(
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
    sourceEffectiveAt: RECORD_TIMES.sourceEffectiveAt,
    ingestedAt: RECORD_TIMES.ingestedAt,
    ...overrides,
  });
}

/**
 * Builds an audit that ran against {@link buildRecordSnapshot} seed 1, at its source time.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes audits; drives the default `id` and `auditVersion`.
 * @returns A validated audit snapshot.
 */
export function buildRecordAudit(
  overrides: Partial<AuditSnapshotInput> = {},
  seed = 1,
): AuditSnapshot {
  return buildAuditSnapshot(
    {
      generatedAt: RECORD_TIMES.auditGeneratedAt,
      studentRecordEffectiveAt: RECORD_TIMES.sourceEffectiveAt,
      ...overrides,
    },
    seed,
  );
}
