/**
 * @file Tests for the pinned records service: session scoping, missing and tied records, the
 * out-of-scope backstop, and ID-only logging. `isSourceFresh` is tested in source-freshness.
 * @requirement FR-04
 * @requirement FR-05
 * @requirement NFR-04
 */
import { describe, expect, it } from 'vitest';

import type { AuditSnapshotRepository, StudentSnapshotRepository } from '@caa/db';
import type { AuditSnapshot, StudentSnapshot } from '@caa/domain';
import {
  buildActor,
  buildCourseAttempt,
  buildStudent,
  SYNTHETIC_TENANTS,
  syntheticId,
} from '@caa/test-kit';

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
import { createPinnedRecordsService } from './pinned-records.service';

const actor = buildActor();
const student = buildStudent({ userId: actor.userId });
const attempt = buildCourseAttempt();
const snapshot = buildRecordSnapshot({ attemptIds: [attempt.id] });
const audit = buildRecordAudit();

/** What the fake repositories hold, or repositories that replace them. */
interface Setup {
  readonly studentSnapshots?: readonly StudentSnapshot[];
  readonly audits?: readonly AuditSnapshot[];
  readonly repositories?: {
    readonly studentSnapshots?: StudentSnapshotRepository;
    readonly auditSnapshots?: AuditSnapshotRepository;
  };
}

/**
 * Creates the service over in-memory repositories and loads `student`'s records as `actor`.
 *
 * @param setup - Records, or replacement repositories.
 * @returns The load's promise and the recording logger.
 */
function load(setup: Setup = {}) {
  const store = createInMemoryRepositories({
    identities: [],
    students: [student],
    assignments: [],
    attempts: [attempt],
    studentSnapshots: setup.studentSnapshots ?? [snapshot],
    audits: setup.audits ?? [audit],
  });
  const logger = createRecordingLogger();
  const service = createPinnedRecordsService({
    studentSnapshots: setup.repositories?.studentSnapshots ?? store.studentSnapshots,
    auditSnapshots: setup.repositories?.auditSnapshots ?? store.auditSnapshots,
    // NOTE: loadLatest never reads the clock; the freshness gate is tested through course checks.
    now: () => new Date(Number.NaN),
    maxSourceAgeMs: 0,
  });
  return { result: service.loadLatest(actor, student, { logger }), logger };
}

/**
 * Builds a snapshot repository that always answers with the given snapshot.
 *
 * @param found - The snapshot to return.
 * @returns The repository.
 */
function snapshotsReturning(found: StudentSnapshot): StudentSnapshotRepository {
  return {
    findLatest: () =>
      Promise.resolve({ status: 'FOUND', revision: { snapshot: found, attempts: [] } }),
    findById: () => Promise.resolve(null),
  };
}

describe('PinnedRecordsService.loadLatest', () => {
  it('returns the latest revision with its attempts, and the latest audit', async () => {
    expect(await load().result).toEqual({ revision: { snapshot, attempts: [attempt] }, audit });
  });

  it('returns no audit, never a fabricated one, when the student has none', async () => {
    expect((await load({ audits: [] }).result).audit).toBeNull();
  });

  it('reads records for the session tenant and the access-checked student only', async () => {
    const calls: unknown[] = [];
    const { result } = load({
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

  it('throws SOURCE_UNAVAILABLE and logs the reason when the student has no snapshot', async () => {
    const { result, logger } = load({ studentSnapshots: [] });

    await expect(result).rejects.toBeInstanceOf(SourceUnavailableError);
    expect(logger.entries).toEqual([
      {
        level: 'info',
        message: 'academic record unavailable',
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
    const { result, logger } = load({ studentSnapshots: [snapshot, buildRecordSnapshot({}, 2)] });

    await expect(result).rejects.toBeInstanceOf(StaleSourceError);
    expect(logger.entries[0]?.details).toMatchObject({ reason: 'STUDENT_SNAPSHOT_AMBIGUOUS' });
  });

  it('throws STALE_SOURCE, never a pick or "no audit", when two audits tie for latest', async () => {
    const { result, logger } = load({ audits: [audit, buildRecordAudit({}, 2)] });

    await expect(result).rejects.toBeInstanceOf(StaleSourceError);
    expect(logger.entries[0]?.details).toMatchObject({ reason: 'AUDIT_AMBIGUOUS' });
  });
});

describe('PinnedRecordsService.loadLatest out-of-scope backstop', () => {
  const foreignAudits: readonly [string, AuditSnapshot][] = [
    ['another tenant', buildRecordAudit({ tenantId: SYNTHETIC_TENANTS.b.id }, 9)],
    ['another student', buildRecordAudit({ studentId: syntheticId('student', 2) }, 9)],
  ];

  it.each(foreignAudits)(
    'returns NOT_FOUND and logs a security event for an audit of %s',
    async (_case, foreign) => {
      const { result, logger } = load({
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
          message: 'academic record out of scope',
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

  it.each([
    ['another tenant', buildRecordSnapshot({ tenantId: SYNTHETIC_TENANTS.b.id }, 9)],
    ['another student', buildRecordSnapshot({ studentId: syntheticId('student', 2) }, 9)],
  ])('returns NOT_FOUND and logs a security event for a snapshot of %s', async (_case, foreign) => {
    const { result, logger } = load({
      repositories: { studentSnapshots: snapshotsReturning(foreign) },
    });

    await expect(result).rejects.toBeInstanceOf(NotFoundError);
    expect(logger.entries.map((entry) => [entry.level, entry.details.recordId])).toEqual([
      ['warn', foreign.id],
    ]);
  });
});
