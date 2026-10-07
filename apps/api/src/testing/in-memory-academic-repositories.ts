/**
 * @file In-memory fakes of the academic repositories for API tests: snapshots, audits, catalog,
 * prerequisite rules, policies, and terms. Test code only; never wired by the container.
 * @module @caa/api/testing/in-memory-academic-repositories
 * @see docs/standards/07-testing.md
 */
import type {
  AcademicPolicyRepository,
  AuditSnapshotRepository,
  CourseCatalogRepository,
  PrerequisiteRuleRepository,
  ProgramRepository,
  StudentSnapshotRepository,
  StudentSnapshotRevision,
  TermRepository,
} from '@caa/db';
import {
  type AcademicPolicy,
  type AuditSnapshot,
  type Course,
  type CourseAttempt,
  createTermCalendar,
  type InstitutionId,
  type PrerequisiteRule,
  type Program,
  type StudentId,
  type StudentSnapshot,
  type Term,
} from '@caa/domain';

/** Academic backing data. Every field omitted means none stored. */
export interface InMemoryAcademicStore {
  attempts?: readonly CourseAttempt[];
  studentSnapshots?: readonly StudentSnapshot[];
  audits?: readonly AuditSnapshot[];
  courses?: readonly Course[];
  programs?: readonly Program[];
  rules?: readonly PrerequisiteRule[];
  policies?: readonly AcademicPolicy[];
  terms?: readonly Term[];
}

/** The academic repositories the fakes implement. */
export interface InMemoryAcademicRepositories {
  readonly studentSnapshots: StudentSnapshotRepository;
  readonly auditSnapshots: AuditSnapshotRepository;
  readonly courseCatalog: CourseCatalogRepository;
  readonly programs: ProgramRepository;
  readonly prerequisiteRules: PrerequisiteRuleRepository;
  readonly academicPolicies: AcademicPolicyRepository;
  readonly terms: TermRepository;
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

/**
 * Pairs a snapshot with the stored attempts it lists.
 *
 * @param store - Backing data.
 * @param snapshot - The snapshot.
 * @returns The revision; attempts not in the store are left out.
 */
function revisionOf(
  store: InMemoryAcademicStore,
  snapshot: StudentSnapshot,
): StudentSnapshotRevision {
  const attempts = snapshot.attemptIds.flatMap(
    (id) => (store.attempts ?? []).find((attempt) => attempt.id === id) ?? [],
  );
  return { snapshot, attempts };
}

/**
 * Creates the student snapshot repository over the store. A revision carries the stored
 * attempts its snapshot lists, in the snapshot's `attemptIds` order.
 *
 * @param store - Backing data. Read on every call.
 * @returns A {@link StudentSnapshotRepository}.
 */
function createStudentSnapshots(store: InMemoryAcademicStore): StudentSnapshotRepository {
  return {
    findLatest: (tenantId, studentId) => {
      const latest = findLatestOf(
        store.studentSnapshots ?? [],
        { tenantId, studentId },
        (item) => item.sourceEffectiveAt,
      );
      return Promise.resolve(
        latest?.status === 'FOUND'
          ? { status: 'FOUND', revision: revisionOf(store, latest.record) }
          : latest,
      );
    },
    findById: (tenantId, id) => {
      const snapshot = (store.studentSnapshots ?? []).find(
        (item) => item.tenantId === tenantId && item.id === id,
      );
      return Promise.resolve(snapshot === undefined ? null : revisionOf(store, snapshot));
    },
  };
}

/**
 * Creates the audit snapshot repository over the store.
 *
 * @param store - Backing data. Read on every call.
 * @returns An {@link AuditSnapshotRepository}.
 */
function createAuditSnapshots(store: InMemoryAcademicStore): AuditSnapshotRepository {
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
 * Creates the academic repositories over the store, filtered by tenant like PostgreSQL.
 *
 * @param store - Backing data. Read on every call.
 * @returns Every academic repository.
 */
export function createInMemoryAcademicRepositories(
  store: InMemoryAcademicStore,
): InMemoryAcademicRepositories {
  return {
    studentSnapshots: createStudentSnapshots(store),
    auditSnapshots: createAuditSnapshots(store),
    courseCatalog: {
      findCatalog: (tenantId) =>
        Promise.resolve(
          (store.courses ?? [])
            .filter((course) => course.tenantId === tenantId)
            .toSorted((left, right) => left.sourceCourseId.localeCompare(right.sourceCourseId)),
        ),
    },
    programs: {
      findById: (tenantId, programId) =>
        Promise.resolve(
          (store.programs ?? []).find(
            (program) => program.tenantId === tenantId && program.id === programId,
          ) ?? null,
        ),
    },
    prerequisiteRules: {
      findRule: (tenantId, courseId, rulesetVersion) =>
        Promise.resolve(
          (store.rules ?? []).find(
            (rule) =>
              rule.tenantId === tenantId &&
              rule.courseId === courseId &&
              rule.rulesetVersion === rulesetVersion,
          ) ?? null,
        ),
    },
    academicPolicies: {
      findPolicy: (tenantId, rulesetVersion) =>
        Promise.resolve(
          (store.policies ?? []).find(
            (policy) => policy.tenantId === tenantId && policy.rulesetVersion === rulesetVersion,
          ) ?? null,
        ),
    },
    terms: {
      findOrdered: (tenantId) =>
        Promise.resolve(
          createTermCalendar(
            (store.terms ?? [])
              .filter((term) => term.tenantId === tenantId)
              .toSorted((left, right) => left.sequence - right.sequence),
          ),
        ),
    },
  };
}
