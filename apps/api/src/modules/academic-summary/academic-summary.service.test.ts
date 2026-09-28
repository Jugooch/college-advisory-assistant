/**
 * @file Tests for the academic summary service: access, scoping, the engine's audit verdicts,
 * missing and tied records, the out-of-scope backstop, and ID-only logging.
 * @requirement FR-02
 * @requirement FR-04
 * @requirement FR-05
 * @requirement NFR-04
 */
import { describe, expect, it } from 'vitest';

import type { AuditSnapshotRepository, StudentSnapshotRepository } from '@caa/db';
import { type AuditSnapshot, CheckState, ReasonCode, type StudentSnapshot } from '@caa/domain';
import { buildActor, buildStudent, SYNTHETIC_TENANTS, syntheticId } from '@caa/test-kit';

import {
  NotFoundError,
  SourceUnavailableError,
  StaleSourceError,
} from '../../shared/domain-errors';
import { buildRecordAudit, buildRecordSnapshot } from '../../testing/academic-fixtures';
import {
  createInMemoryRepositories,
  createRecordingLogger,
} from '../../testing/in-memory-repositories';
import { createAcademicSummaryService } from './academic-summary.service';

const MAX_SKEW_MS = 3_600_000;
const actor = buildActor();
const student = buildStudent({ userId: actor.userId });
const snapshot = buildRecordSnapshot();
const audit = buildRecordAudit();

/** What the fake repositories hold, and whether the fake access check allows the read. */
interface Setup {
  readonly isAllowed?: boolean;
  readonly studentSnapshots?: readonly StudentSnapshot[];
  readonly audits?: readonly AuditSnapshot[];
  readonly repositories?: {
    readonly studentSnapshots?: StudentSnapshotRepository;
    readonly auditSnapshots?: AuditSnapshotRepository;
  };
}

/**
 * Creates the service over in-memory repositories and a fixed access decision, and reads the
 * summary of `student` as `actor`.
 *
 * @param setup - Records, access decision, and optional replacement repositories.
 * @returns The read's promise and the recording logger.
 */
function read(setup: Setup = {}) {
  const store = createInMemoryRepositories({
    identities: [],
    students: [student],
    assignments: [],
    studentSnapshots: setup.studentSnapshots ?? [snapshot],
    audits: setup.audits ?? [audit],
  });
  const logger = createRecordingLogger();
  const service = createAcademicSummaryService({
    students: {
      getStudent: () =>
        setup.isAllowed === false ? Promise.reject(new NotFoundError()) : Promise.resolve(student),
    },
    studentSnapshots: setup.repositories?.studentSnapshots ?? store.studentSnapshots,
    auditSnapshots: setup.repositories?.auditSnapshots ?? store.auditSnapshots,
    maxSkewMs: MAX_SKEW_MS,
  });
  return { result: service.getAcademicSummary(actor, student.id, { logger }), logger };
}

describe('AcademicSummaryService.getAcademicSummary', () => {
  it('returns the pinned record and an audit that reflects it on the same program', async () => {
    const { result } = read();

    expect(await result).toEqual({
      student,
      studentSnapshot: snapshot,
      audit: {
        audit,
        reflectsRecord: { state: CheckState.Pass, reasonCode: null },
        programCatalogConsistency: { state: CheckState.Pass, reasonCode: null },
      },
    });
  });

  it('returns and logs no audit, never a fabricated one, when the student has none', async () => {
    const { result, logger } = read({ audits: [] });

    expect((await result).audit).toBeNull();
    expect(logger.entries[0]?.details).toMatchObject({
      auditSnapshotId: null,
      auditReflectsRecord: null,
      programCatalogConsistency: null,
    });
  });

  it('marks the audit AUDIT_STALE when a newer snapshot is the pinned record', async () => {
    const newer = buildRecordSnapshot(
      { sourceEffectiveAt: '2026-09-01T05:00:00.000Z', ingestedAt: '2026-09-01T06:00:00.000Z' },
      2,
    );

    const { result } = read({ studentSnapshots: [snapshot, newer] });
    const summary = await result;

    expect(summary.studentSnapshot).toEqual(newer);
    expect(summary.audit?.reflectsRecord).toEqual({
      state: CheckState.Unknown,
      reasonCode: ReasonCode.AuditStale,
    });
  });

  it('applies the configured skew: exactly the skew passes, one millisecond more is stale', async () => {
    const at = (offsetMs: number) =>
      read({
        audits: [
          buildRecordAudit({
            studentRecordEffectiveAt: new Date(
              Date.parse(snapshot.sourceEffectiveAt) - offsetMs,
            ).toISOString(),
          }),
        ],
      }).result;

    expect((await at(MAX_SKEW_MS)).audit?.reflectsRecord.state).toBe(CheckState.Pass);
    expect((await at(MAX_SKEW_MS + 1)).audit?.reflectsRecord).toEqual({
      state: CheckState.Unknown,
      reasonCode: ReasonCode.AuditStale,
    });
  });

  it('marks the audit AUDIT_PROGRAM_MISMATCH when the record states no catalog', async () => {
    const { result } = read({ studentSnapshots: [buildRecordSnapshot({ catalogYear: null })] });

    expect((await result).audit?.programCatalogConsistency).toEqual({
      state: CheckState.Unknown,
      reasonCode: ReasonCode.AuditProgramMismatch,
    });
  });

  it('reads records for the session tenant and the path student only', async () => {
    const calls: unknown[] = [];
    const { result } = read({
      repositories: {
        studentSnapshots: {
          findLatest: (...args) => {
            calls.push(['snapshot', ...args]);
            return Promise.resolve({ status: 'FOUND', revision: { snapshot, attempts: [] } });
          },
          findById: () => Promise.resolve(null),
        },
        auditSnapshots: {
          findLatest: (...args) => {
            calls.push(['audit', ...args]);
            return Promise.resolve(null);
          },
        },
      },
    });

    await result;

    expect(calls).toEqual([
      ['snapshot', actor.tenantId, student.id],
      ['audit', actor.tenantId, student.id],
    ]);
  });

  it('throws NOT_FOUND without reading any record when access is denied', async () => {
    const reads: string[] = [];
    const { result } = read({
      isAllowed: false,
      repositories: {
        studentSnapshots: {
          findLatest: () => Promise.resolve(null).finally(() => reads.push('snapshot')),
          findById: () => Promise.resolve(null),
        },
        auditSnapshots: {
          findLatest: () => Promise.resolve(null).finally(() => reads.push('audit')),
        },
      },
    });

    await expect(result).rejects.toBeInstanceOf(NotFoundError);
    expect(reads).toEqual([]);
  });

  it('throws SOURCE_UNAVAILABLE and logs the reason when the student has no snapshot', async () => {
    const { result, logger } = read({ studentSnapshots: [] });

    await expect(result).rejects.toBeInstanceOf(SourceUnavailableError);
    expect(logger.entries).toEqual([
      {
        level: 'info',
        message: 'academic summary unavailable',
        details: {
          actorUserId: actor.userId,
          tenantId: actor.tenantId,
          studentId: student.id,
          reason: 'NO_STUDENT_SNAPSHOT',
        },
      },
    ]);
  });

  it('throws STALE_SOURCE, never a pick, when two snapshots tie for latest', async () => {
    const { result, logger } = read({
      studentSnapshots: [snapshot, buildRecordSnapshot({}, 2)],
    });

    await expect(result).rejects.toBeInstanceOf(StaleSourceError);
    expect(logger.entries[0]?.details).toMatchObject({ reason: 'STUDENT_SNAPSHOT_AMBIGUOUS' });
  });

  it('throws STALE_SOURCE, never a pick or "no audit", when two audits tie for latest', async () => {
    const { result, logger } = read({ audits: [audit, buildRecordAudit({}, 2)] });

    await expect(result).rejects.toBeInstanceOf(StaleSourceError);
    expect(logger.entries[0]?.details).toMatchObject({ reason: 'AUDIT_AMBIGUOUS' });
  });
});

describe('AcademicSummaryService.getAcademicSummary out-of-scope backstop', () => {
  const foreignAudits: readonly [string, AuditSnapshot][] = [
    ['another tenant', buildRecordAudit({ tenantId: SYNTHETIC_TENANTS.b.id }, 9)],
    ['another student', buildRecordAudit({ studentId: syntheticId('student', 2) }, 9)],
  ];

  it.each(foreignAudits)(
    'returns NOT_FOUND and logs a security event for an audit of %s',
    async (_case, foreign) => {
      const { result, logger } = read({
        repositories: {
          auditSnapshots: {
            findLatest: () => Promise.resolve({ status: 'FOUND', audit: foreign }),
          },
        },
      });

      await expect(result).rejects.toBeInstanceOf(NotFoundError);
      expect(logger.entries).toEqual([
        {
          level: 'warn',
          message: 'academic summary record out of scope',
          details: {
            actorUserId: actor.userId,
            tenantId: actor.tenantId,
            studentId: student.id,
            recordId: foreign.id,
          },
        },
      ]);
    },
  );

  it('returns NOT_FOUND and logs a security event for a snapshot of another tenant', async () => {
    const foreign = buildRecordSnapshot({ tenantId: SYNTHETIC_TENANTS.b.id }, 9);
    const { result, logger } = read({
      repositories: {
        studentSnapshots: {
          findLatest: () =>
            Promise.resolve({ status: 'FOUND', revision: { snapshot: foreign, attempts: [] } }),
          findById: () => Promise.resolve(null),
        },
      },
    });

    await expect(result).rejects.toBeInstanceOf(NotFoundError);
    expect(logger.entries.map((entry) => [entry.level, entry.details.recordId])).toEqual([
      ['warn', foreign.id],
    ]);
  });
});

describe('AcademicSummaryService.getAcademicSummary logging', () => {
  it('logs the read with opaque IDs and verdicts only', async () => {
    const { result, logger } = read();

    await result;

    expect(logger.entries).toEqual([
      {
        level: 'info',
        message: 'academic summary read',
        details: {
          actorUserId: actor.userId,
          tenantId: actor.tenantId,
          studentId: student.id,
          studentSnapshotId: snapshot.id,
          auditSnapshotId: audit.id,
          auditReflectsRecord: CheckState.Pass,
          programCatalogConsistency: CheckState.Pass,
        },
      },
    ]);
    expect(JSON.stringify(logger.entries)).not.toContain(student.sourceStudentId);
  });
});
