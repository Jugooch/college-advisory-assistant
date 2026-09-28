/**
 * @file Builds one student's academic summary from the latest pinned record and audit.
 * @module @caa/api/modules/academic-summary/academic-summary.service
 * @requirement FR-02
 * @requirement FR-04
 * @requirement FR-05
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
} from '@caa/db';
import type {
  Actor,
  AuditSnapshot,
  InstitutionId,
  Student,
  StudentId,
  StudentSnapshot,
} from '@caa/domain';
import {
  type AuditProgramConsistency,
  type AuditRecordReflection,
  checkAuditProgramAndCatalog,
  checkAuditReflectsRecord,
} from '@caa/engine';

import {
  NotFoundError,
  SourceUnavailableError,
  StaleSourceError,
} from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import type { StudentsService } from '../students/students.service';

/** Dependencies of the academic summary service. */
export interface AcademicSummaryServiceDependencies {
  /** Applies the S1 access rule and loads the student. */
  readonly students: StudentsService;
  readonly studentSnapshots: StudentSnapshotRepository;
  readonly auditSnapshots: AuditSnapshotRepository;
  /** Validated `AUDIT_RECORD_MAX_SKEW_MS`: the allowed record and audit skew in milliseconds. */
  readonly maxSkewMs: number;
}

/** The audit the summary shows, with the engine's verdicts on it. */
export interface SummarizedAudit {
  readonly audit: AuditSnapshot;
  readonly reflectsRecord: AuditRecordReflection;
  readonly programCatalogConsistency: AuditProgramConsistency;
}

/** One student's pinned record and, when there is one, their latest audit. */
export interface AcademicSummary {
  readonly student: Student;
  readonly studentSnapshot: StudentSnapshot;
  /** `null` when the student has no audit; never a fabricated one. */
  readonly audit: SummarizedAudit | null;
}

/** Academic summary reads, each gated by the students service's access rule. */
export interface AcademicSummaryService {
  /**
   * Reads the summary of one student the actor may see.
   *
   * @param actor - Authenticated actor from the session.
   * @param studentId - Internal student ID from the path.
   * @param context - Request-scoped values; every log line carries the request ID.
   * @returns The student, their latest snapshot, and their latest audit with its verdicts.
   * @throws {NotFoundError} When the student doesn't exist, the actor may not see them, or a
   *   loaded record belongs to another tenant or student.
   * @throws {SourceUnavailableError} When the student has no record snapshot.
   * @throws {StaleSourceError} When the latest snapshot or audit is tied, so none is latest.
   */
  getAcademicSummary(
    actor: Actor,
    studentId: StudentId,
    context: RequestContext,
  ): Promise<AcademicSummary>;
}

/** The tenant and student every loaded record must belong to. */
interface SummaryScope {
  readonly actor: Actor;
  readonly tenantId: InstitutionId;
  readonly studentId: StudentId;
  readonly context: RequestContext;
}

/** Why no summary could be built. Logged; the client sees only the error code. */
type UnavailableReason = 'NO_STUDENT_SNAPSHOT' | 'STUDENT_SNAPSHOT_AMBIGUOUS' | 'AUDIT_AMBIGUOUS';

/**
 * Logs why no summary could be built, with opaque IDs only.
 *
 * @param scope - The session's tenant and the path student.
 * @param reason - Why the summary is unavailable.
 */
function logUnavailable(scope: SummaryScope, reason: UnavailableReason): void {
  const { actor, tenantId, studentId } = scope;
  scope.context.logger.info(
    { actorUserId: actor.userId, tenantId, studentId, reason },
    'academic summary unavailable',
  );
}

/**
 * Stops the read when a loaded record is not the session tenant's and the path student's.
 *
 * @param scope - The session's tenant and the path student.
 * @param record - The loaded snapshot or audit.
 * @throws {NotFoundError} On any mismatch, after logging a security event.
 */
function assertInScope(scope: SummaryScope, record: StudentSnapshot | AuditSnapshot): void {
  if (record.tenantId === scope.tenantId && record.studentId === scope.studentId) {
    return;
  }
  // SECURITY: defense in depth (standards/09). The repositories already filter by the session's
  // tenant and the path student, so this only fires on a data or repository defect. The
  // record is dropped, the client sees the same NOT_FOUND as a forbidden student, and the log
  // names opaque IDs only, never the foreign record's contents.
  const { actor, tenantId, studentId } = scope;
  scope.context.logger.warn(
    { actorUserId: actor.userId, tenantId, studentId, recordId: record.id },
    'academic summary record out of scope',
  );
  throw new NotFoundError();
}

/**
 * Picks the pinned snapshot from the repository's answer.
 *
 * @param scope - The session's tenant and the path student.
 * @param latest - The repository's latest snapshot, ambiguity, or `null`.
 * @returns The snapshot every check reads.
 * @throws {SourceUnavailableError} When there is no snapshot.
 * @throws {StaleSourceError} When two snapshots are tied for latest.
 * @throws {NotFoundError} When the snapshot is out of scope.
 */
function pinSnapshot(scope: SummaryScope, latest: LatestStudentSnapshot | null): StudentSnapshot {
  // SAFETY: with no record there is nothing to summarize, and a tie means the source doesn't
  // say which record is current. Neither is guessed; the student is referred to an advisor
  // (planning/07 §Consistency model; planning/08: missing or conflicting data is UNKNOWN).
  if (latest === null) {
    logUnavailable(scope, 'NO_STUDENT_SNAPSHOT');
    throw new SourceUnavailableError();
  }
  if (latest.status === 'AMBIGUOUS') {
    logUnavailable(scope, 'STUDENT_SNAPSHOT_AMBIGUOUS');
    throw new StaleSourceError();
  }
  assertInScope(scope, latest.revision.snapshot);
  return latest.revision.snapshot;
}

/**
 * Picks the audit from the repository's answer and runs the engine's audit checks on it.
 *
 * @param scope - The session's tenant and the path student.
 * @param latest - The repository's latest audit, ambiguity, or `null`.
 * @param pinned - The pinned snapshot and the configured skew.
 * @returns The audit with its verdicts, or `null` when the student has no audit.
 * @throws {StaleSourceError} When two audits are tied for latest.
 * @throws {NotFoundError} When the audit is out of scope.
 */
function summarizeAudit(
  scope: SummaryScope,
  latest: LatestAuditSnapshot | null,
  pinned: { readonly studentSnapshot: StudentSnapshot; readonly maxSkewMs: number },
): SummarizedAudit | null {
  if (latest === null) {
    return null;
  }
  // SAFETY: a tie means neither audit's requirement states can be shown as the audit's, and
  // `audit: null` would claim the student has none. The read is refused and referred instead.
  if (latest.status === 'AMBIGUOUS') {
    logUnavailable(scope, 'AUDIT_AMBIGUOUS');
    throw new StaleSourceError();
  }
  const { audit } = latest;
  assertInScope(scope, audit);
  return {
    audit,
    reflectsRecord: checkAuditReflectsRecord(audit, pinned.studentSnapshot, pinned.maxSkewMs),
    programCatalogConsistency: checkAuditProgramAndCatalog(pinned.studentSnapshot, audit),
  };
}

/**
 * Logs a built summary with opaque IDs and the verdicts' reason codes only.
 *
 * @param scope - The session's tenant and the path student.
 * @param studentSnapshot - The pinned snapshot.
 * @param audit - The summarized audit, or `null`.
 */
function logRead(
  scope: SummaryScope,
  studentSnapshot: StudentSnapshot,
  audit: SummarizedAudit | null,
): void {
  const { actor, tenantId, studentId } = scope;
  const verdictOf = (check: AuditRecordReflection | AuditProgramConsistency | undefined) =>
    check?.reasonCode ?? check?.state ?? null;
  scope.context.logger.info(
    {
      actorUserId: actor.userId,
      tenantId,
      studentId,
      studentSnapshotId: studentSnapshot.id,
      auditSnapshotId: audit?.audit.id ?? null,
      auditReflectsRecord: verdictOf(audit?.reflectsRecord),
      programCatalogConsistency: verdictOf(audit?.programCatalogConsistency),
    },
    'academic summary read',
  );
}

/**
 * Creates the academic summary service.
 *
 * @param dependencies - Students service, snapshot repositories, and the configured skew.
 * @returns An {@link AcademicSummaryService}.
 */
export function createAcademicSummaryService(
  dependencies: AcademicSummaryServiceDependencies,
): AcademicSummaryService {
  const { students, studentSnapshots, auditSnapshots, maxSkewMs } = dependencies;
  return {
    async getAcademicSummary(actor, studentId, context) {
      // SECURITY: the same rule as GET /v1/students/:studentId (self, assigned advisor, or admin
      // of the same tenant). Denied and missing are the same NOT_FOUND.
      const student = await students.getStudent(actor, studentId, context);
      // SECURITY: every record is read for the session's tenant and the path student only.
      const scope: SummaryScope = {
        actor,
        tenantId: actor.tenantId,
        studentId: student.id,
        context,
      };
      const [latestSnapshot, latestAudit] = await Promise.all([
        studentSnapshots.findLatest(scope.tenantId, scope.studentId),
        auditSnapshots.findLatest(scope.tenantId, scope.studentId),
      ]);
      const studentSnapshot = pinSnapshot(scope, latestSnapshot);
      const audit = summarizeAudit(scope, latestAudit, { studentSnapshot, maxSkewMs });
      logRead(scope, studentSnapshot, audit);
      return { student, studentSnapshot, audit };
    },
  };
}
