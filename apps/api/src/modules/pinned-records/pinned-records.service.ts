/**
 * @file Loads a student's latest pinned record snapshot and audit, scoped to the session, and
 * refuses missing, tied, out-of-scope, or (for validated reads) stale records instead of guessing.
 * @module @caa/api/modules/pinned-records/pinned-records.service
 * @requirement FR-04
 * @requirement FR-05
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/planning/07-system-architecture-and-design.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 * @see docs/standards/09-errors-logging-and-security.md
 */
import type {
  AuditSnapshotRepository,
  LatestAuditSnapshot,
  LatestStudentSnapshot,
  StudentSnapshotRepository,
  StudentSnapshotRevision,
} from '@caa/db';
import type { Actor, AuditSnapshot, Student, StudentId, StudentSnapshot } from '@caa/domain';

import {
  NotFoundError,
  SourceUnavailableError,
  StaleSourceError,
} from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';

/** Dependencies of the pinned records service. */
export interface PinnedRecordsServiceDependencies {
  readonly studentSnapshots: StudentSnapshotRepository;
  readonly auditSnapshots: AuditSnapshotRepository;
}

/** The latest record revision of one student and, when there is one, their latest audit. */
export interface PinnedRecords {
  /** The pinned snapshot with the attempts it contains. */
  readonly revision: StudentSnapshotRevision;
  /** `null` when the student has no audit; never a fabricated one. */
  readonly audit: AuditSnapshot | null;
}

/** Loads the pinned inputs every academic read starts from. */
export interface PinnedRecordsService {
  /**
   * Loads the student's latest snapshot and audit. Call only with a student the actor has
   * already been allowed to see (`StudentsService.getStudent`).
   *
   * @param actor - Authenticated actor from the session; supplies the tenant.
   * @param student - The student the access check returned.
   * @param context - Request-scoped values; every log line carries the request ID.
   * @returns The pinned revision and the audit, or `null` for no audit.
   * @throws {SourceUnavailableError} When the student has no snapshot.
   * @throws {StaleSourceError} When two snapshots or two audits are tied for latest.
   * @throws {NotFoundError} When a loaded record belongs to another tenant or student.
   */
  loadLatest(actor: Actor, student: Student, context: RequestContext): Promise<PinnedRecords>;
}

/** Why an academic read can't be answered. Logged; the client sees only the error code. */
export type RecordUnavailableReason =
  | 'NO_STUDENT_SNAPSHOT'
  | 'STUDENT_SNAPSHOT_AMBIGUOUS'
  | 'AUDIT_AMBIGUOUS'
  | 'NO_AUDIT'
  | 'NO_ACADEMIC_POLICY'
  | 'SOURCE_NOT_FRESH';

/** The session's tenant and the path student every loaded record must belong to. */
export interface RecordScope {
  readonly actor: Actor;
  readonly studentId: StudentId;
  readonly context: RequestContext;
}

/**
 * Logs why an academic read can't be answered, with opaque IDs only.
 *
 * @param scope - The actor, the path student, and the request context.
 * @param reason - Why the read is unavailable.
 */
export function logRecordUnavailable(scope: RecordScope, reason: RecordUnavailableReason): void {
  const { actor, studentId } = scope;
  scope.context.logger.info(
    { actorUserId: actor.userId, tenantId: actor.tenantId, studentId, reason },
    'academic record unavailable',
  );
}

/**
 * Most a source time may be ahead of the clock and still count as fresh: five minutes, for clock
 * drift between the source system and this server. Anything further ahead is not fresh.
 */
export const SOURCE_TIME_FUTURE_TOLERANCE_MS = 300_000;

/** The clock reading and the configured maximum age a freshness decision uses. */
export interface FreshnessPolicy {
  /** The injected clock's current time; read by the caller, never by the engine. */
  readonly now: Date;
  /** Validated `ACADEMIC_SOURCE_MAX_AGE_MS`. */
  readonly maxAgeMs: number;
}

/**
 * Decides whether a source time is fresh enough for a validated result.
 *
 * @param sourceTime - The time the source data describes, ISO 8601 with offset; may be missing.
 * @param policy - The current time and the maximum age.
 * @returns `true` when the time is at most `maxAgeMs` old (exactly at the limit is fresh) and
 *   no more than the tolerance in the future; `false` when it is missing or unparseable.
 */
export function isSourceFresh(
  sourceTime: string | null | undefined,
  policy: FreshnessPolicy,
): boolean {
  const instant = typeof sourceTime === 'string' ? Date.parse(sourceTime) : Number.NaN;
  // SAFETY: a missing or unreadable time can't show the data is recent, and a time far in the
  // future is a source error; neither is treated as fresh (planning/09 §Proposed freshness
  // policies; planning/08: missing or conflicting data is UNKNOWN or a referral).
  if (Number.isNaN(instant)) {
    return false;
  }
  const ageMs = policy.now.getTime() - instant;
  return ageMs <= policy.maxAgeMs && ageMs >= -SOURCE_TIME_FUTURE_TOLERANCE_MS;
}

/**
 * Refuses a validated read when the pinned record or the audit's record time is not fresh.
 *
 * @param scope - The actor, the path student, and the request context.
 * @param records - The pinned snapshot and audit.
 * @param policy - The current time and the maximum age.
 * @throws {StaleSourceError} When either time is not fresh, after logging the reason.
 */
export function assertSourcesFresh(
  scope: RecordScope,
  records: { readonly snapshot: StudentSnapshot; readonly audit: AuditSnapshot },
  policy: FreshnessPolicy,
): void {
  if (
    isSourceFresh(records.snapshot.sourceEffectiveAt, policy) &&
    isSourceFresh(records.audit.studentRecordEffectiveAt, policy)
  ) {
    return;
  }
  // SAFETY: a transcript, program, or audit older than the maximum age is historical only, so it
  // never yields a PASS or a validated plan; the student is referred to refresh first
  // (planning/09 §Proposed freshness policies; CLAUDE.md: stale data is never PASS).
  logRecordUnavailable(scope, 'SOURCE_NOT_FRESH');
  throw new StaleSourceError();
}

/**
 * Stops the read when a loaded record is not the session tenant's and the path student's.
 *
 * @param scope - The actor, the path student, and the request context.
 * @param record - The loaded snapshot or audit.
 * @throws {NotFoundError} On any mismatch, after logging a security event.
 */
function assertInScope(scope: RecordScope, record: StudentSnapshot | AuditSnapshot): void {
  const { actor, studentId } = scope;
  if (record.tenantId === actor.tenantId && record.studentId === studentId) {
    return;
  }
  // SECURITY: defense in depth (standards/09), checked before any engine call. The repositories
  // already filter by the session's tenant and the path student, so this only fires on a data
  // or repository defect. The record is dropped, the client sees the same NOT_FOUND as a
  // forbidden student, and the log names opaque IDs only, never the foreign record's contents.
  scope.context.logger.warn(
    { actorUserId: actor.userId, tenantId: actor.tenantId, studentId, recordId: record.id },
    'academic record out of scope',
  );
  throw new NotFoundError();
}

/**
 * Picks the pinned revision from the repository's answer.
 *
 * @param scope - The actor, the path student, and the request context.
 * @param latest - The repository's latest snapshot, ambiguity, or `null`.
 * @returns The revision every check reads.
 * @throws {SourceUnavailableError} When there is no snapshot.
 * @throws {StaleSourceError} When two snapshots are tied for latest.
 * @throws {NotFoundError} When the snapshot is out of scope.
 */
function pinRevision(
  scope: RecordScope,
  latest: LatestStudentSnapshot | null,
): StudentSnapshotRevision {
  // SAFETY: with no record there is nothing to read, and a tie means the source doesn't say
  // which record is current. Neither is guessed; the student is referred to an advisor
  // (planning/07 §Consistency model; planning/08: missing or conflicting data is UNKNOWN).
  if (latest === null) {
    logRecordUnavailable(scope, 'NO_STUDENT_SNAPSHOT');
    throw new SourceUnavailableError();
  }
  if (latest.status === 'AMBIGUOUS') {
    logRecordUnavailable(scope, 'STUDENT_SNAPSHOT_AMBIGUOUS');
    throw new StaleSourceError();
  }
  assertInScope(scope, latest.revision.snapshot);
  return latest.revision;
}

/**
 * Picks the audit from the repository's answer.
 *
 * @param scope - The actor, the path student, and the request context.
 * @param latest - The repository's latest audit, ambiguity, or `null`.
 * @returns The audit, or `null` when the student has none.
 * @throws {StaleSourceError} When two audits are tied for latest.
 * @throws {NotFoundError} When the audit is out of scope.
 */
function pinAudit(scope: RecordScope, latest: LatestAuditSnapshot | null): AuditSnapshot | null {
  if (latest === null) {
    return null;
  }
  // SAFETY: a tie means neither audit's requirement states can be read as the audit's, and
  // "no audit" would be false. The read is refused and referred instead.
  if (latest.status === 'AMBIGUOUS') {
    logRecordUnavailable(scope, 'AUDIT_AMBIGUOUS');
    throw new StaleSourceError();
  }
  assertInScope(scope, latest.audit);
  return latest.audit;
}

/**
 * Creates the pinned records service.
 *
 * @param dependencies - The snapshot and audit repositories.
 * @returns A {@link PinnedRecordsService}.
 */
export function createPinnedRecordsService(
  dependencies: PinnedRecordsServiceDependencies,
): PinnedRecordsService {
  const { studentSnapshots, auditSnapshots } = dependencies;
  return {
    async loadLatest(actor, student, context) {
      // SECURITY: both reads are for the session's tenant and the access-checked student only.
      const scope: RecordScope = { actor, studentId: student.id, context };
      const [latestSnapshot, latestAudit] = await Promise.all([
        studentSnapshots.findLatest(actor.tenantId, student.id),
        auditSnapshots.findLatest(actor.tenantId, student.id),
      ]);
      const revision = pinRevision(scope, latestSnapshot);
      return { revision, audit: pinAudit(scope, latestAudit) };
    },
  };
}
