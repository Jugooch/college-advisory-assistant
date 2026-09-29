/**
 * @file QA-owned in-memory academic repositories for the API acceptance harness: student
 * snapshots, audit snapshots, catalog, prerequisite rules, policies, and terms. Each one follows
 * the documented repository contract, written here from that contract and not copied from the API
 * team's fakes, so the acceptance oracle stays independent of the code under test
 * (docs/standards/07-testing.md, Acceptance tests).
 * @module @caa/tests/support/academic-repositories
 * @see docs/planning/07-system-architecture-and-design.md
 * @see docs/standards/07-testing.md
 */
import type {
  AcademicPolicyRepository,
  AuditSnapshotRepository,
  CourseCatalogRepository,
  PrerequisiteRuleRepository,
  StudentSnapshotRepository,
  StudentSnapshotRevision,
  TermRepository,
} from '@caa/api/testing';
import {
  type AcademicPolicy,
  type AuditSnapshot,
  type Course,
  type CourseAttempt,
  createTermCalendar,
  type InstitutionId,
  type PrerequisiteRule,
  type StudentId,
  type StudentSnapshot,
  type Term,
} from '@caa/domain';

/** Academic backing data. A field that is omitted means nothing of that kind is stored. */
export interface AcademicWorld {
  attempts?: readonly CourseAttempt[];
  studentSnapshots?: readonly StudentSnapshot[];
  audits?: readonly AuditSnapshot[];
  courses?: readonly Course[];
  rules?: readonly PrerequisiteRule[];
  policies?: readonly AcademicPolicy[];
  terms?: readonly Term[];
}

/** The academic repositories the API reads. */
export interface AcademicRepositories {
  readonly studentSnapshots: StudentSnapshotRepository;
  readonly auditSnapshots: AuditSnapshotRepository;
  readonly courseCatalog: CourseCatalogRepository;
  readonly prerequisiteRules: PrerequisiteRuleRepository;
  readonly academicPolicies: AcademicPolicyRepository;
  readonly terms: TermRepository;
}

/** Latest-record lookup result: the one record, a tie, or nothing. */
type Latest<TRecord> =
  { readonly status: 'FOUND'; readonly record: TRecord } | { readonly status: 'AMBIGUOUS' } | null;

/**
 * Picks the student's record with the strictly newest time. As the repository contract states,
 * a tie on the newest time is `AMBIGUOUS`, never a pick, and another tenant's record is never
 * returned.
 *
 * @param records - Every stored record.
 * @param owner - Tenant and student to look up.
 * @param timeOf - The record's ordering time, ISO 8601 with offset.
 * @returns The newest record, the tie, or null when the student has none.
 */
function latestOf<TRecord extends { tenantId: InstitutionId; studentId: StudentId }>(
  records: readonly TRecord[],
  owner: { readonly tenantId: InstitutionId; readonly studentId: StudentId },
  timeOf: (record: TRecord) => string,
): Latest<TRecord> {
  const own = records.filter(
    (item) => item.tenantId === owner.tenantId && item.studentId === owner.studentId,
  );
  const newestAt = Math.max(...own.map((item) => Date.parse(timeOf(item))));
  const newest = own.filter((item) => Date.parse(timeOf(item)) === newestAt);
  const [only, ...tied] = newest;
  if (only === undefined) {
    return null;
  }
  return tied.length > 0 ? { status: 'AMBIGUOUS' } : { status: 'FOUND', record: only };
}

/**
 * Pairs a snapshot with the stored attempts it lists, in its `attemptIds` order.
 *
 * @param world - Backing data.
 * @param snapshot - The snapshot.
 * @returns The revision. A listed attempt that isn't stored is left out.
 */
function revisionOf(world: AcademicWorld, snapshot: StudentSnapshot): StudentSnapshotRevision {
  const stored = (world.attempts ?? []).filter((item) => item.tenantId === snapshot.tenantId);
  const attempts = snapshot.attemptIds.flatMap(
    (id) => stored.find((attempt) => attempt.id === id) ?? [],
  );
  return { snapshot, attempts };
}

/**
 * Creates the student snapshot repository: latest by `sourceEffectiveAt`, or one by ID.
 *
 * @param world - Backing data. Read on every call.
 * @returns A {@link StudentSnapshotRepository}.
 */
function createStudentSnapshots(world: AcademicWorld): StudentSnapshotRepository {
  return {
    findLatest: (tenantId, studentId) => {
      const latest = latestOf(
        world.studentSnapshots ?? [],
        { tenantId, studentId },
        (item) => item.sourceEffectiveAt,
      );
      return Promise.resolve(
        latest?.status === 'FOUND'
          ? { status: 'FOUND', revision: revisionOf(world, latest.record) }
          : latest,
      );
    },
    findById: (tenantId, id) => {
      const snapshot = (world.studentSnapshots ?? []).find(
        (item) => item.tenantId === tenantId && item.id === id,
      );
      return Promise.resolve(snapshot === undefined ? null : revisionOf(world, snapshot));
    },
  };
}

/**
 * Creates the audit snapshot repository: latest by `generatedAt`.
 *
 * @param world - Backing data. Read on every call.
 * @returns An {@link AuditSnapshotRepository}.
 */
function createAuditSnapshots(world: AcademicWorld): AuditSnapshotRepository {
  return {
    findLatest: (tenantId, studentId) => {
      const latest = latestOf(
        world.audits ?? [],
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
 * Creates every academic repository over the world, each scoped to the tenant it is asked for.
 *
 * @param world - Backing data. Read on every call, so a case can change it between requests.
 * @returns The academic repositories.
 */
export function createAcademicRepositories(world: AcademicWorld): AcademicRepositories {
  return {
    studentSnapshots: createStudentSnapshots(world),
    auditSnapshots: createAuditSnapshots(world),
    courseCatalog: {
      findCatalog: (tenantId) =>
        Promise.resolve(
          (world.courses ?? [])
            .filter((item) => item.tenantId === tenantId)
            .toSorted((left, right) => left.sourceCourseId.localeCompare(right.sourceCourseId)),
        ),
    },
    prerequisiteRules: {
      findRule: (tenantId, courseId, rulesetVersion) =>
        Promise.resolve(
          (world.rules ?? []).find(
            (item) =>
              item.tenantId === tenantId &&
              item.courseId === courseId &&
              item.rulesetVersion === rulesetVersion,
          ) ?? null,
        ),
    },
    academicPolicies: {
      findPolicy: (tenantId, rulesetVersion) =>
        Promise.resolve(
          (world.policies ?? []).find(
            (item) => item.tenantId === tenantId && item.rulesetVersion === rulesetVersion,
          ) ?? null,
        ),
    },
    terms: {
      findOrdered: (tenantId) =>
        Promise.resolve(
          createTermCalendar(
            (world.terms ?? [])
              .filter((item) => item.tenantId === tenantId)
              .toSorted((left, right) => left.sequence - right.sequence),
          ),
        ),
    },
  };
}
