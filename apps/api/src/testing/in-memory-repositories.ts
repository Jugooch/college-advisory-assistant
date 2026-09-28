/**
 * @file In-memory repository fakes for API tests. Test code only; never wired by the container.
 * @module @caa/api/testing/in-memory-repositories
 * @see docs/standards/07-testing.md
 */
import type { AuditSnapshotRepository, StudentSnapshotRepository } from '@caa/db';
import type {
  AdvisorAssignment,
  AuditSnapshot,
  InstitutionId,
  Student,
  StudentId,
  StudentSnapshot,
  UserIdentity,
} from '@caa/domain';

import type { Repositories } from '../container';
import type { Logger } from '../shared/logger';

/** Mutable backing data, so a test can change it between two calls (for example to revoke). */
export interface InMemoryStore {
  identities: readonly UserIdentity[];
  students: readonly Student[];
  assignments: readonly AdvisorAssignment[];
  /** Student record snapshots. Omitted means none. */
  studentSnapshots?: readonly StudentSnapshot[];
  /** Degree audit snapshots. Omitted means none. */
  audits?: readonly AuditSnapshot[];
}

/** The tenant and student a latest-record lookup is for. */
interface LatestKey {
  readonly tenantId: InstitutionId;
  readonly studentId: StudentId;
}

/**
 * Finds the record with the strictly latest time, like the PostgreSQL repositories: a tie on
 * the latest time is `AMBIGUOUS`, never a pick.
 *
 * @param records - Every record in the store.
 * @param key - Tenant and student to filter by.
 * @param timeOf - Reads the ordering time of a record.
 * @returns The latest record, the ambiguity, or null when there is none.
 */
function findLatestOf<TRecord extends LatestKey>(
  records: readonly TRecord[],
  key: LatestKey,
  timeOf: (record: TRecord) => string,
):
  { readonly status: 'FOUND'; readonly record: TRecord } | { readonly status: 'AMBIGUOUS' } | null {
  const [newest, runnerUp] = records
    .filter((item) => item.tenantId === key.tenantId && item.studentId === key.studentId)
    .sort((left, right) => Date.parse(timeOf(right)) - Date.parse(timeOf(left)));
  if (newest === undefined) {
    return null;
  }
  if (runnerUp !== undefined && Date.parse(timeOf(runnerUp)) === Date.parse(timeOf(newest))) {
    return { status: 'AMBIGUOUS' };
  }
  return { status: 'FOUND', record: newest };
}

/** One line written to a {@link RecordingLogger}. */
export interface LogEntry {
  readonly level: 'info' | 'warn';
  readonly details: Record<string, unknown>;
  readonly message: string;
}

/** Logger that keeps every line in memory for assertions. */
export interface RecordingLogger extends Logger {
  readonly entries: readonly LogEntry[];
}

/**
 * Creates the student snapshot repository over the store. Revisions carry no attempts.
 *
 * @param store - Backing data. Read on every call.
 * @returns A {@link StudentSnapshotRepository}.
 */
function createStudentSnapshots(store: InMemoryStore): StudentSnapshotRepository {
  return {
    findLatest: (tenantId, studentId) => {
      const latest = findLatestOf(
        store.studentSnapshots ?? [],
        { tenantId, studentId },
        (item) => item.sourceEffectiveAt,
      );
      return Promise.resolve(
        latest?.status === 'FOUND'
          ? { status: 'FOUND', revision: { snapshot: latest.record, attempts: [] } }
          : latest,
      );
    },
    findById: (tenantId, id) => {
      const snapshot = (store.studentSnapshots ?? []).find(
        (item) => item.tenantId === tenantId && item.id === id,
      );
      return Promise.resolve(snapshot === undefined ? null : { snapshot, attempts: [] });
    },
  };
}

/**
 * Creates the audit snapshot repository over the store.
 *
 * @param store - Backing data. Read on every call.
 * @returns An {@link AuditSnapshotRepository}.
 */
function createAuditSnapshots(store: InMemoryStore): AuditSnapshotRepository {
  return {
    findLatest: (tenantId, studentId) => {
      const latest = findLatestOf(
        store.audits ?? [],
        { tenantId, studentId },
        (item) => item.generatedAt,
      );
      return Promise.resolve(
        latest?.status === 'FOUND' ? { status: 'FOUND', audit: latest.record } : latest,
      );
    },
  };
}

/**
 * Creates repositories over an in-memory store with the same tenant and time-window rules as the
 * PostgreSQL repositories.
 *
 * @param store - Backing data. Read on every call.
 * @returns Every repository, including the optional academic ones, for the container.
 */
export function createInMemoryRepositories(store: InMemoryStore): Required<Repositories> {
  return {
    userIdentities: {
      findByIssuerSubject: (issuer, subject) =>
        Promise.resolve(
          store.identities.find((item) => item.issuer === issuer && item.subject === subject) ??
            null,
        ),
    },
    students: {
      findById: (tenantId, id) =>
        Promise.resolve(
          store.students.find((item) => item.tenantId === tenantId && item.id === id) ?? null,
        ),
      findBySourceStudentId: (tenantId, sourceStudentId) =>
        Promise.resolve(
          store.students.find(
            (item) => item.tenantId === tenantId && item.sourceStudentId === sourceStudentId,
          ) ?? null,
        ),
    },
    studentSnapshots: createStudentSnapshots(store),
    auditSnapshots: createAuditSnapshots(store),
    advisorAssignments: {
      findActive: (tenantId, { advisorUserId, studentId, at }) => {
        const instant = Date.parse(at);
        const active = store.assignments.find(
          (item) =>
            item.tenantId === tenantId &&
            item.advisorUserId === advisorUserId &&
            item.studentId === studentId &&
            Date.parse(item.effectiveFrom) <= instant &&
            (item.effectiveTo === null || instant < Date.parse(item.effectiveTo)),
        );
        return Promise.resolve(active ?? null);
      },
    },
  };
}

/**
 * Creates a logger that records every line.
 *
 * @returns A {@link RecordingLogger}.
 */
export function createRecordingLogger(): RecordingLogger {
  const entries: LogEntry[] = [];
  return {
    entries,
    info: (details, message) => {
      entries.push({ level: 'info', details, message });
    },
    warn: (details, message) => {
      entries.push({ level: 'warn', details, message });
    },
  };
}
