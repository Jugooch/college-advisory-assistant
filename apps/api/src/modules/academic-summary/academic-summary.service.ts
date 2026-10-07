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
import type { CourseDisplay } from '@caa/api-contract';
import type { CourseCatalogRepository, ProgramRepository } from '@caa/db';
import type {
  Actor,
  AuditSnapshot,
  ProgramId,
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

import type { RequestContext } from '../../shared/request-context';
import { selectCourseDisplays } from '../course-display/course-display.logic';
import type { PinnedRecordsService, RecordScope } from '../pinned-records/pinned-records.service';
import type { StudentsService } from '../students/students.service';

/** Dependencies of the academic summary service. */
export interface AcademicSummaryServiceDependencies {
  /** Applies the S1 access rule and loads the student. */
  readonly students: StudentsService;
  /**
   * Loads the latest snapshot and audit, refusing missing, tied, or out-of-scope records, and
   * applies the source freshness gate.
   */
  readonly pinnedRecords: PinnedRecordsService;
  /** Validated `AUDIT_RECORD_MAX_SKEW_MS`: the allowed record and audit skew in milliseconds. */
  readonly maxSkewMs: number;
  /** Supplies the display entries of the audit's candidate courses. */
  readonly courseCatalog: CourseCatalogRepository;
  /** Supplies the catalog names of the record's and the audit's programs. */
  readonly programs: ProgramRepository;
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
  /** Code and credit rule of the audit's candidate courses in the catalog; empty without one. */
  readonly courses: readonly CourseDisplay[];
  /** Catalog names of the record's program and the audit's program; `null` means unknown. */
  readonly programNames: {
    readonly record: string | null;
    readonly audit: string | null;
  };
}

/** Academic summary reads, each gated by the students service's access rule. */
export interface AcademicSummaryService {
  /**
   * Reads the summary of one student the actor may see.
   *
   * @param actor - Authenticated actor from the session.
   * @param studentId - Internal student ID from the path.
   * @param context - Request-scoped values; every log line carries the request ID.
   * @returns The student, their latest snapshot, their latest audit with its verdicts, and the
   *   display entries of the audit's candidate courses.
   * @throws {NotFoundError} When the student doesn't exist, the actor may not see them, or a
   *   loaded record belongs to another tenant or student (see `PinnedRecordsService`).
   * @throws {SourceUnavailableError} When the student has no record snapshot.
   * @throws {StaleSourceError} When the latest snapshot or audit is tied, so none is latest, or
   *   the record or the audit's record time is older than the maximum source age, missing, or
   *   too far in the future.
   */
  getAcademicSummary(
    actor: Actor,
    studentId: StudentId,
    context: RequestContext,
  ): Promise<AcademicSummary>;
}

/**
 * Runs the engine's audit checks on the audit.
 *
 * @param audit - The pinned audit, or `null`.
 * @param pinned - The pinned snapshot and the configured skew.
 * @returns The audit with its verdicts, or `null` when the student has no audit.
 */
function summarizeAudit(
  audit: AuditSnapshot | null,
  pinned: { readonly studentSnapshot: StudentSnapshot; readonly maxSkewMs: number },
): SummarizedAudit | null {
  if (audit === null) {
    return null;
  }
  return {
    audit,
    reflectsRecord: checkAuditReflectsRecord(audit, pinned.studentSnapshot, pinned.maxSkewMs),
    programCatalogConsistency: checkAuditProgramAndCatalog(pinned.studentSnapshot, audit),
  };
}

/**
 * Loads the display entries of the audit's candidate courses from the session tenant's catalog.
 *
 * @param courseCatalog - The catalog repository.
 * @param actor - Supplies the tenant.
 * @param audit - The pinned audit, or `null`.
 * @returns The entries; none, without a catalog read, when there is no audit.
 */
async function candidateCourses(
  courseCatalog: CourseCatalogRepository,
  actor: Actor,
  audit: AuditSnapshot | null,
): Promise<readonly CourseDisplay[]> {
  const candidateIds = audit?.requirements.flatMap((node) => node.candidateCourseIds) ?? [];
  if (candidateIds.length === 0) {
    return [];
  }
  // SECURITY: the catalog is read for the session's tenant only.
  return selectCourseDisplays(candidateIds, await courseCatalog.findCatalog(actor.tenantId));
}

/**
 * Looks up a program's catalog name in the session tenant's catalog.
 *
 * @param programs - The program repository.
 * @param actor - Supplies the tenant.
 * @param programId - The program a record or audit states, or `null` when it states none.
 * @returns The stored name; `null` when no program is stated, it isn't in the catalog, or the
 *   catalog has no name for it. A name is never derived from the program's source ID.
 */
async function programNameOf(
  programs: ProgramRepository,
  actor: Actor,
  programId: ProgramId | null,
): Promise<string | null> {
  if (programId === null) {
    return null;
  }
  // SECURITY: the program is read for the session's tenant only.
  return (await programs.findById(actor.tenantId, programId))?.name ?? null;
}

/**
 * Logs a built summary with opaque IDs and the verdicts' reason codes only.
 *
 * @param scope - The session's tenant and the path student.
 * @param studentSnapshot - The pinned snapshot.
 * @param audit - The summarized audit, or `null`.
 */
function logRead(
  scope: RecordScope,
  studentSnapshot: StudentSnapshot,
  audit: SummarizedAudit | null,
): void {
  const { actor, studentId } = scope;
  const verdictOf = (check: AuditRecordReflection | AuditProgramConsistency | undefined) =>
    check?.reasonCode ?? check?.state ?? null;
  scope.context.logger.info(
    {
      actorUserId: actor.userId,
      tenantId: actor.tenantId,
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
 * @param dependencies - Students service, pinned records service, the configured skew, and the
 *   course catalog.
 * @returns An {@link AcademicSummaryService}.
 */
export function createAcademicSummaryService(
  dependencies: AcademicSummaryServiceDependencies,
): AcademicSummaryService {
  const { students, pinnedRecords, maxSkewMs, courseCatalog, programs } = dependencies;
  return {
    async getAcademicSummary(actor, studentId, context) {
      // SECURITY: the same rule as GET /v1/students/:studentId (self, assigned advisor, or admin
      // of the same tenant). Denied and missing are the same NOT_FOUND.
      const student = await students.getStudent(actor, studentId, context);
      const { revision, audit } = await pinnedRecords.loadLatest(actor, student, context);
      const studentSnapshot = revision.snapshot;
      const scope: RecordScope = { actor, studentId: student.id, context };
      // SAFETY: a summary is served only from fresh sources, so a stale record or audit is never
      // shown as current standing; the student is referred instead (ADR-0008 Amendment 1).
      pinnedRecords.assertFresh(scope, { snapshot: studentSnapshot, audit });
      const summarized = summarizeAudit(audit, { studentSnapshot, maxSkewMs });
      const courses = await candidateCourses(courseCatalog, actor, audit);
      const programNames = {
        record: await programNameOf(programs, actor, studentSnapshot.programId),
        audit: await programNameOf(programs, actor, audit?.programId ?? null),
      };
      logRead(scope, studentSnapshot, summarized);
      return { student, studentSnapshot, audit: summarized, courses, programNames };
    },
  };
}
