/**
 * @file Tests for the academic summary service: access, the engine's audit verdicts, and ID-only
 * logging. Loading, ties, and the out-of-scope backstop are tested with the pinned records service.
 * @requirement FR-02
 * @requirement FR-04
 * @requirement FR-05
 * @requirement NFR-04
 */
import { describe, expect, it } from 'vitest';

import type { AuditSnapshotRepository, StudentSnapshotRepository } from '@caa/db';
import {
  type AuditSnapshot,
  CheckState,
  type Course,
  CreditRuleKind,
  ReasonCode,
  type StudentSnapshot,
} from '@caa/domain';
import { buildActor, buildStudent, SYNTHETIC_COURSES, SYNTHETIC_TENANTS } from '@caa/test-kit';

import {
  NotFoundError,
  SourceUnavailableError,
  StaleSourceError,
} from '../../shared/domain-errors';
import { buildRecordAudit, buildRecordSnapshot } from '../../testing/academic-fixtures';
import { TEST_NOW } from '../../testing/fixtures';
import {
  createInMemoryRepositories,
  createRecordingLogger,
} from '../../testing/in-memory-repositories';
import { createPinnedRecordsService } from '../pinned-records/pinned-records.service';
import { createAcademicSummaryService } from './academic-summary.service';

const MAX_SKEW_MS = 3_600_000;
/** 24 hours, the dev `ACADEMIC_SOURCE_MAX_AGE_MS`. */
const MAX_AGE_MS = 86_400_000;
const actor = buildActor();
const student = buildStudent({ userId: actor.userId });
const snapshot = buildRecordSnapshot();
const audit = buildRecordAudit();

/** What the fake repositories hold, the clock, and whether the fake access check allows the read. */
interface Setup {
  readonly isAllowed?: boolean;
  /** The clock reading; defaults to `TEST_NOW`, when the default record is 23.5 hours old. */
  readonly now?: string;
  readonly studentSnapshots?: readonly StudentSnapshot[];
  readonly audits?: readonly AuditSnapshot[];
  /** The catalog; defaults to every synthetic course of tenant A. */
  readonly courses?: readonly Course[];
  readonly repositories?: {
    readonly studentSnapshots?: StudentSnapshotRepository;
    readonly auditSnapshots?: AuditSnapshotRepository;
  };
}

/**
 * Creates the service over in-memory repositories and a fixed access decision, and reads the
 * summary of `student` as `actor`.
 *
 * @param setup - Records, clock, access decision, and optional replacement repositories.
 * @returns The read's promise and the recording logger.
 */
function read(setup: Setup = {}) {
  const store = createInMemoryRepositories({
    identities: [],
    students: [student],
    assignments: [],
    studentSnapshots: setup.studentSnapshots ?? [snapshot],
    audits: setup.audits ?? [audit],
    courses: setup.courses ?? Object.values(SYNTHETIC_COURSES),
  });
  const logger = createRecordingLogger();
  const service = createAcademicSummaryService({
    students: {
      getStudent: () =>
        setup.isAllowed === false ? Promise.reject(new NotFoundError()) : Promise.resolve(student),
    },
    pinnedRecords: createPinnedRecordsService({
      studentSnapshots: setup.repositories?.studentSnapshots ?? store.studentSnapshots,
      auditSnapshots: setup.repositories?.auditSnapshots ?? store.auditSnapshots,
      now: () => (setup.now === undefined ? TEST_NOW : new Date(setup.now)),
      maxSourceAgeMs: MAX_AGE_MS,
    }),
    maxSkewMs: MAX_SKEW_MS,
    courseCatalog: store.courseCatalog,
    programs: store.programs,
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
      programNames: { record: null, audit: null },
      courses: [
        {
          courseId: SYNTHETIC_COURSES.math102.id,
          code: SYNTHETIC_COURSES.math102.label,
          title: null,
          credits: { kind: CreditRuleKind.Fixed, creditsHundredths: 300 },
        },
      ],
    });
  });

  it("lists no display entry for a candidate outside the session tenant's catalog", async () => {
    const foreign = { ...SYNTHETIC_COURSES.math102, tenantId: SYNTHETIC_TENANTS.b.id };

    expect((await read({ courses: [foreign] }).result).courses).toEqual([]);
  });

  it('returns and logs no audit, never a fabricated one, when the student has none', async () => {
    const { result, logger } = read({ audits: [] });

    expect(await result).toMatchObject({ audit: null, courses: [] });
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
        // NOTE: shortly after the record, so the older audit record time is still fresh.
        now: '2026-08-31T13:00:00.000Z',
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

  it('passes on the pinned records refusal when the student has no snapshot', async () => {
    await expect(read({ studentSnapshots: [] }).result).rejects.toBeInstanceOf(
      SourceUnavailableError,
    );
  });
});

/**
 * Returns an instant a given time after another.
 *
 * @param iso - ISO 8601 instant.
 * @param ms - Milliseconds to add.
 * @returns The later instant.
 */
function after(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

describe('AcademicSummaryService.getAcademicSummary source freshness', () => {
  it('serves a record and audit exactly at the maximum age', async () => {
    const { result } = read({ now: after(snapshot.sourceEffectiveAt, MAX_AGE_MS) });

    expect((await result).studentSnapshot).toEqual(snapshot);
  });

  it('refers the student with STALE_SOURCE one millisecond past the maximum age', async () => {
    const { result, logger } = read({ now: after(snapshot.sourceEffectiveAt, MAX_AGE_MS + 1) });

    await expect(result).rejects.toBeInstanceOf(StaleSourceError);
    expect(logger.entries).toEqual([
      expect.objectContaining({
        message: 'academic record unavailable',
        details: expect.objectContaining({ reason: 'SOURCE_NOT_FRESH' }) as unknown,
      }),
    ]);
  });

  it('refuses a fresh record whose audit ran against a record past the maximum age', async () => {
    const oldAudit = buildRecordAudit({
      studentRecordEffectiveAt: after(snapshot.sourceEffectiveAt, -MAX_AGE_MS),
    });

    await expect(read({ audits: [oldAudit] }).result).rejects.toBeInstanceOf(StaleSourceError);
  });

  it('refuses a record dated more than 5 minutes after the clock', async () => {
    const { result } = read({ now: after(snapshot.sourceEffectiveAt, -300_001) });

    await expect(result).rejects.toBeInstanceOf(StaleSourceError);
  });

  it('checks only the record when the student has no audit', async () => {
    const fresh = read({ audits: [], now: after(snapshot.sourceEffectiveAt, MAX_AGE_MS) });
    const stale = read({ audits: [], now: after(snapshot.sourceEffectiveAt, MAX_AGE_MS + 1) });

    expect((await fresh.result).audit).toBeNull();
    await expect(stale.result).rejects.toBeInstanceOf(StaleSourceError);
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
