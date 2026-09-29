/**
 * @file Checks a candidate course set for one student against the pinned record, audit, and rules.
 * @module @caa/api/modules/course-checks/course-checks.service
 * @requirement FR-02
 * @requirement FR-04
 * @requirement FR-05
 * @requirement FR-06
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/planning/07-system-architecture-and-design.md
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/standards/09-errors-logging-and-security.md
 */
import type {
  AcademicPolicyRepository,
  CourseCatalogRepository,
  PrerequisiteRuleRepository,
  TermRepository,
} from '@caa/db';
import type {
  AcademicPolicy,
  Actor,
  AuditSnapshot,
  Course,
  CourseId,
  StudentId,
} from '@caa/domain';
import {
  AuditRecordInputError,
  CandidateSetInputError,
  PrerequisiteInputMismatchError,
} from '@caa/engine';

import {
  InvalidRequestError,
  RulesetNotConfiguredError,
  SourceUnavailableError,
} from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import {
  type CourseChecks,
  type CourseSetInputs,
  verifyCourseSet,
} from '../course-verification/course-verification.logic';
import type { PinnedRecordsService, RecordScope } from '../pinned-records/pinned-records.service';
import type { StudentsService } from '../students/students.service';

/** Dependencies of the course checks service. */
export interface CourseChecksServiceDependencies {
  /** Applies the S1 access rule and loads the student. */
  readonly students: StudentsService;
  /**
   * Loads the latest snapshot and audit, refusing missing, tied, or out-of-scope records, and
   * applies the source freshness gate.
   */
  readonly pinnedRecords: PinnedRecordsService;
  readonly courseCatalog: CourseCatalogRepository;
  readonly prerequisiteRules: PrerequisiteRuleRepository;
  readonly academicPolicies: AcademicPolicyRepository;
  readonly terms: TermRepository;
  /** Validated `AUDIT_RECORD_MAX_SKEW_MS`: the allowed record and audit skew in milliseconds. */
  readonly maxSkewMs: number;
  /** Validated `ACTIVE_RULESET_VERSION`, or `null` when none is configured. */
  readonly rulesetVersion: string | null;
}

/** What the caller asks to check: the path student and the body. Identity is never part of it. */
export interface CourseChecksQuery {
  /** Internal student ID from the path. */
  readonly studentId: StudentId;
  /** Distinct candidate courses, in the order results are returned. */
  readonly courseIds: readonly CourseId[];
  /** Chosen credits for variable-credit courses; a course with none has no chosen value. */
  readonly creditSelections?:
    | readonly { readonly courseId: CourseId; readonly selectedCreditsHundredths: number }[]
    | undefined;
}

/** Course checks, each gated by the students service's access rule. */
export interface CourseChecksService {
  /**
   * Checks a candidate course set for one student the actor may see.
   *
   * @param actor - Authenticated actor from the session.
   * @param query - The path student, and the courses and credit choices from the validated body.
   * @param context - Request-scoped values; every log line carries the request ID.
   * @returns Per-course and set checks from the engine, their aggregate, and the pinned inputs.
   * @throws {NotFoundError} When the student doesn't exist, the actor may not see them, or a
   *   loaded record belongs to another tenant or student.
   * @throws {SourceUnavailableError} When the student has no snapshot or no audit, or the
   *   active ruleset has no policy.
   * @throws {StaleSourceError} When two snapshots or two audits are tied for latest, or the
   *   record or the audit's record time is older than the maximum source age.
   * @throws {InvalidRequestError} When a course isn't in the tenant's catalog, or the engine
   *   rejects the inputs.
   * @throws {RulesetNotConfiguredError} When no active ruleset is configured.
   */
  checkCourses(
    actor: Actor,
    query: CourseChecksQuery,
    context: RequestContext,
  ): Promise<CourseChecks>;
}

/**
 * Logs why a course-check request was rejected, with opaque IDs and a reason only.
 *
 * @param scope - The actor, the path student, and the request context.
 * @param reason - The rejection reason, for example `COURSE_NOT_IN_CATALOG`.
 */
function logRejected(scope: RecordScope, reason: string): void {
  const { actor, studentId } = scope;
  scope.context.logger.info(
    { actorUserId: actor.userId, tenantId: actor.tenantId, studentId, reason },
    'course checks rejected',
  );
}

/**
 * Returns the audit, or refers the student to an advisor when there is none.
 *
 * @param pinnedRecords - Logs the unavailable reason.
 * @param scope - The actor, the path student, and the request context.
 * @param audit - The pinned audit, or `null`.
 * @returns The audit.
 * @throws {SourceUnavailableError} When there is no audit.
 */
function requireAudit(
  pinnedRecords: PinnedRecordsService,
  scope: RecordScope,
  audit: AuditSnapshot | null,
): AuditSnapshot {
  // SAFETY: applicability and allocation come only from the audit, and the response pins its
  // version, so without one there is nothing to check against. The student is referred, never
  // shown guessed applicability (planning/08: missing data is UNKNOWN or a referral; #100).
  if (audit === null) {
    pinnedRecords.recordUnavailable(scope, 'NO_AUDIT');
    throw new SourceUnavailableError();
  }
  return audit;
}

/**
 * Returns the active ruleset's policy, or refers the student when the tenant has none.
 *
 * @param pinnedRecords - Logs the unavailable reason.
 * @param scope - The actor, the path student, and the request context.
 * @param policy - The policy the repository found, or `null`.
 * @returns The policy.
 * @throws {SourceUnavailableError} When there is no policy.
 */
function requirePolicy(
  pinnedRecords: PinnedRecordsService,
  scope: RecordScope,
  policy: AcademicPolicy | null,
): AcademicPolicy {
  if (policy === null) {
    pinnedRecords.recordUnavailable(scope, 'NO_ACADEMIC_POLICY');
    throw new SourceUnavailableError();
  }
  return policy;
}

/**
 * Finds each requested course in the tenant's catalog, in request order.
 *
 * @param scope - The actor, the path student, and the request context.
 * @param courseIds - The requested courses.
 * @param catalog - The tenant's catalog.
 * @returns The catalog courses.
 * @throws {InvalidRequestError} When any requested course isn't in the catalog.
 */
function resolveCourses(
  scope: RecordScope,
  courseIds: readonly CourseId[],
  catalog: readonly Course[],
): readonly Course[] {
  const byId = new Map(catalog.map((course) => [course.id, course]));
  const courses = courseIds.flatMap((courseId) => byId.get(courseId) ?? []);
  // SAFETY: a course outside the tenant's catalog has no credits, rule, or equivalents to check,
  // so it can't join the set checks. The whole request is refused rather than dropping it or
  // passing it (planning/08 §Candidate formation).
  if (courses.length !== courseIds.length) {
    logRejected(scope, 'COURSE_NOT_IN_CATALOG');
    throw new InvalidRequestError();
  }
  return courses;
}

/**
 * Runs the engine, turning its input errors into INVALID_REQUEST without internal details.
 *
 * @param scope - The actor, the path student, and the request context.
 * @param inputs - Every pinned input.
 * @returns The checks.
 * @throws {InvalidRequestError} When the engine rejects an input.
 */
function runChecks(scope: RecordScope, inputs: CourseSetInputs): CourseChecks {
  try {
    return verifyCourseSet(inputs);
  } catch (error) {
    if (
      error instanceof CandidateSetInputError ||
      error instanceof AuditRecordInputError ||
      error instanceof PrerequisiteInputMismatchError
    ) {
      logRejected(scope, error.name);
      throw new InvalidRequestError();
    }
    throw error;
  }
}

/**
 * Creates the course checks service.
 *
 * @param dependencies - Access, pinned records, catalog, rule, policy, and term repositories,
 *   and the configured skew and ruleset.
 * @returns A {@link CourseChecksService}.
 */
export function createCourseChecksService(
  dependencies: CourseChecksServiceDependencies,
): CourseChecksService {
  const { students, pinnedRecords, rulesetVersion, maxSkewMs } = dependencies;
  return {
    async checkCourses(actor, query, context) {
      // SECURITY: the same rule as the academic summary (self, assigned advisor, or admin of the
      // same tenant). Denied and missing are the same NOT_FOUND.
      const student = await students.getStudent(actor, query.studentId, context);
      if (rulesetVersion === null) {
        throw new RulesetNotConfiguredError();
      }
      const scope: RecordScope = { actor, studentId: student.id, context };
      // SECURITY: every input is read for the session's tenant; nothing comes from the body
      // except course IDs and credit choices.
      const { tenantId } = actor;
      const [records, catalog, policy, termCalendar] = await Promise.all([
        pinnedRecords.loadLatest(actor, student, context),
        dependencies.courseCatalog.findCatalog(tenantId),
        dependencies.academicPolicies.findPolicy(tenantId, rulesetVersion),
        dependencies.terms.findOrdered(tenantId),
      ]);
      const audit = requireAudit(pinnedRecords, scope, records.audit);
      pinnedRecords.assertFresh(scope, { snapshot: records.revision.snapshot, audit });
      const academicPolicy = requirePolicy(pinnedRecords, scope, policy);
      const courses = resolveCourses(scope, query.courseIds, catalog);
      const rules = await Promise.all(
        courses.map((course) =>
          dependencies.prerequisiteRules.findRule(
            tenantId,
            course.id,
            academicPolicy.rulesetVersion,
          ),
        ),
      );
      const checks = runChecks(scope, {
        courses: courses.map((course, index) => ({ course, rule: rules[index] ?? null })),
        creditSelections: query.creditSelections ?? [],
        revision: records.revision,
        audit,
        catalog,
        academicPolicy,
        termCalendar,
        maxSkewMs,
      });
      context.logger.info(
        {
          actorUserId: actor.userId,
          tenantId,
          studentId: student.id,
          ...checks.pinnedInputs,
          courseCount: courses.length,
          aggregate: checks.aggregate,
        },
        'course checks run',
      );
      return checks;
    },
  };
}
