/**
 * @file Loads every pinned input of a requested course set for one student, scoped to the
 * session, and runs the course-set checks with their input errors mapped to honest responses.
 * Shared by course checks and schedule options, so both read and refuse inputs the same way.
 * @module @caa/api/modules/course-set-inputs/course-set-inputs.service
 * @requirement FR-02
 * @requirement FR-05
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
  TermId,
} from '@caa/domain';

import {
  InconsistentInputsError,
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
import { classifyEngineInputError } from '../engine-input-errors/engine-input-errors.logic';
import type { PinnedRecordsService, RecordScope } from '../pinned-records/pinned-records.service';
import type {
  PinnedSections,
  PinnedSectionsService,
} from '../pinned-sections/pinned-sections.service';
import type { StudentsService } from '../students/students.service';

/** Dependencies of the course set inputs service. */
export interface CourseSetInputsServiceDependencies {
  /** Applies the S1 access rule and loads the student. */
  readonly students: StudentsService;
  /**
   * Loads the latest snapshot and audit, refusing missing, tied, or out-of-scope records, and
   * applies the source freshness gate.
   */
  readonly pinnedRecords: PinnedRecordsService;
  /** Loads the term's section snapshot and the transition table, for schedule reads. */
  readonly pinnedSections: PinnedSectionsService;
  readonly courseCatalog: CourseCatalogRepository;
  readonly prerequisiteRules: PrerequisiteRuleRepository;
  readonly academicPolicies: AcademicPolicyRepository;
  readonly terms: TermRepository;
  /** Validated `AUDIT_RECORD_MAX_SKEW_MS`: the allowed record and audit skew in milliseconds. */
  readonly maxSkewMs: number;
  /** Validated `ACTIVE_RULESET_VERSION`, or `null` when none is configured. */
  readonly rulesetVersion: string | null;
}

/** What the caller asks about: the path student and the body. Identity is never part of it. */
export interface CourseSetRequest {
  /** Names the read in log lines, for example `course checks`. */
  readonly operation: string;
  /** Internal student ID from the path. */
  readonly studentId: StudentId;
  /** Distinct requested courses, in the order results are returned. */
  readonly courseIds: readonly CourseId[];
  /** Chosen credits for variable-credit courses; a course with none has no chosen value. */
  readonly creditSelections?:
    | readonly { readonly courseId: CourseId; readonly selectedCreditsHundredths: number }[]
    | undefined;
}

/** A course set request for one term's sections. */
export interface ScheduleSetRequest extends CourseSetRequest {
  /** The term from the validated body; looked up only inside the session's tenant. */
  readonly termId: TermId;
}

/** The pinned inputs of one request, and the scope its log lines and errors use. */
export interface LoadedCourseSet {
  readonly scope: RecordScope;
  /** Every input `verifyCourseSet` reads, the tenant's catalog among them. */
  readonly inputs: CourseSetInputs;
}

/** The pinned inputs of a schedule request: the course set plus the term's section data. */
export interface LoadedScheduleSet extends LoadedCourseSet {
  readonly sections: PinnedSections;
}

/** Loads and checks requested course sets, each gated by the students service's access rule. */
export interface CourseSetInputsService {
  /**
   * Loads every pinned input of a course set for one student the actor may see.
   *
   * @param actor - Authenticated actor from the session.
   * @param request - The path student, the courses and credit choices, and the log label.
   * @param context - Request-scoped values; every log line carries the request ID.
   * @returns The inputs and the scope.
   * @throws {NotFoundError} When the student doesn't exist, the actor may not see them, or a
   *   loaded record belongs to another tenant or student.
   * @throws {SourceUnavailableError} When the student has no snapshot or no audit, or the
   *   active ruleset has no policy.
   * @throws {StaleSourceError} When two snapshots or two audits are tied for latest, or the
   *   record or the audit's record time is older than the maximum source age.
   * @throws {InvalidRequestError} When a course isn't in the tenant's catalog.
   * @throws {RulesetNotConfiguredError} When no active ruleset is configured.
   */
  load(actor: Actor, request: CourseSetRequest, context: RequestContext): Promise<LoadedCourseSet>;

  /**
   * Like `load`, and also pins the term's section snapshot and the transition table, with the
   * snapshot's source time in the same freshness gate as the record and the audit (ADR-0010
   * §6).
   *
   * @param actor - Authenticated actor from the session.
   * @param request - As for `load`, and the term from the validated body.
   * @param context - Request-scoped values.
   * @returns The inputs, the section data, and the scope.
   * @throws {SourceUnavailableError} As `load`, or when the term has no published snapshot.
   * @throws {StaleSourceError} As `load`, or when two section snapshots tie or the latest is
   *   older than the maximum source age.
   */
  loadForTerm(
    actor: Actor,
    request: ScheduleSetRequest,
    context: RequestContext,
  ): Promise<LoadedScheduleSet>;

  /**
   * Runs the course-set checks, turning engine input errors into a typed error for whoever
   * caused them.
   *
   * @param loaded - The pinned inputs and the scope.
   * @param operation - Names the read in log lines.
   * @returns The checks.
   * @throws {InvalidRequestError} When the engine rejects the requested courses or credits.
   * @throws {SourceUnavailableError} When the engine rejects stored data.
   * @throws {InconsistentInputsError} When the loaded inputs contradict each other.
   */
  verify(loaded: LoadedCourseSet, operation: string): CourseChecks;

  /**
   * Turns an error from an engine call into the typed error for whoever caused it, and logs
   * why with opaque IDs only. Errors that aren't engine input errors come back unchanged.
   *
   * @param scope - The actor, the path student, and the request context.
   * @param operation - Names the read in log lines.
   * @param error - Anything the engine threw.
   * @returns The error to throw.
   */
  toTypedError(scope: RecordScope, operation: string, error: unknown): unknown;
}

/**
 * Logs why a request was rejected, with opaque IDs and a reason only.
 *
 * @param scope - The actor, the path student, and the request context.
 * @param operation - Names the read, for example `course checks`.
 * @param reason - The rejection reason, for example `COURSE_NOT_IN_CATALOG`.
 */
function logRejected(scope: RecordScope, operation: string, reason: string): void {
  const { actor, studentId } = scope;
  scope.context.logger.info(
    { actorUserId: actor.userId, tenantId: actor.tenantId, studentId, reason },
    `${operation} rejected`,
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
 * @param request - The requested courses and the log label.
 * @param catalog - The tenant's catalog.
 * @returns The catalog courses.
 * @throws {InvalidRequestError} When any requested course isn't in the catalog.
 */
function resolveCourses(
  scope: RecordScope,
  request: CourseSetRequest,
  catalog: readonly Course[],
): readonly Course[] {
  const byId = new Map(catalog.map((course) => [course.id, course]));
  const courses = request.courseIds.flatMap((courseId) => byId.get(courseId) ?? []);
  // SAFETY: a course outside the tenant's catalog has no credits, rule, or equivalents to check,
  // so it can't join the set checks. The whole request is refused rather than dropping it or
  // passing it (planning/08 §Candidate formation).
  if (courses.length !== request.courseIds.length) {
    logRejected(scope, request.operation, 'COURSE_NOT_IN_CATALOG');
    throw new InvalidRequestError();
  }
  return courses;
}

/**
 * Turns an engine error into the typed error for its cause, and logs why with opaque IDs only.
 *
 * @param scope - The actor, the path student, and the request context.
 * @param operation - Names the read in log lines.
 * @param error - Anything the engine threw.
 * @returns The typed error, or the error unchanged when it isn't an engine input error.
 */
function toTypedError(scope: RecordScope, operation: string, error: unknown): unknown {
  const classification = classifyEngineInputError(error);
  if (classification === null) {
    return error;
  }
  const { cause, reason } = classification;
  if (cause === 'REQUEST') {
    logRejected(scope, operation, reason);
    return new InvalidRequestError();
  }
  const { actor, studentId } = scope;
  // NOTE: stored-data and internal causes are data-integrity problems an operator must see, so
  // they log at warn with opaque IDs and the reason only.
  scope.context.logger.warn(
    { actorUserId: actor.userId, tenantId: actor.tenantId, studentId, cause, reason },
    `${operation} input invalid`,
  );
  // SAFETY: the student did nothing wrong, so they get a referral, not a 400 blaming the request
  // (planning/08: missing or conflicting data is UNKNOWN or a referral; #145).
  return cause === 'STORED_DATA'
    ? new SourceUnavailableError()
    : new InconsistentInputsError(reason, error);
}

/** One load: who asks, what for, and the request context. */
interface LoadCall {
  readonly actor: Actor;
  readonly request: CourseSetRequest;
  readonly context: RequestContext;
}

/**
 * Loads the course set, and the term's sections when the caller pins them.
 *
 * @param dependencies - The service's dependencies.
 * @param call - The actor, the request, and the request context.
 * @param pinSections - Pins the term's sections, or gives `null` for a read without them.
 * @returns The inputs, the scope, and the sections or `null`.
 */
async function loadCourseSet<TSections extends PinnedSections | null>(
  dependencies: CourseSetInputsServiceDependencies,
  call: LoadCall,
  pinSections: (scope: RecordScope) => Promise<TSections>,
): Promise<LoadedCourseSet & { readonly sections: TSections }> {
  const { actor, request, context } = call;
  const { pinnedRecords, rulesetVersion } = dependencies;
  // SECURITY: the same rule as the academic summary (self, assigned advisor, or admin of the
  // same tenant). Denied and missing are the same NOT_FOUND.
  const student = await dependencies.students.getStudent(actor, request.studentId, context);
  if (rulesetVersion === null) {
    throw new RulesetNotConfiguredError();
  }
  const scope: RecordScope = { actor, studentId: student.id, context };
  // SECURITY: every input is read for the session's tenant; nothing comes from the body except
  // course IDs, credit choices, and the term.
  const { tenantId } = actor;
  const [records, catalog, policy, termCalendar] = await Promise.all([
    pinnedRecords.loadLatest(actor, student, context),
    dependencies.courseCatalog.findCatalog(tenantId),
    dependencies.academicPolicies.findPolicy(tenantId, rulesetVersion),
    dependencies.terms.findOrdered(tenantId),
  ]);
  const audit = requireAudit(pinnedRecords, scope, records.audit);
  // NOTE: pinned after the records, so a missing record and a missing snapshot are always
  // refused in the same order.
  const sections = await pinSections(scope);
  pinnedRecords.assertFresh(scope, {
    snapshot: records.revision.snapshot,
    audit,
    ...(sections === null ? {} : { sectionSnapshot: sections.snapshot }),
  });
  const academicPolicy = requirePolicy(pinnedRecords, scope, policy);
  const courses = resolveCourses(scope, request, catalog);
  const rules = await Promise.all(
    courses.map((course) =>
      dependencies.prerequisiteRules.findRule(tenantId, course.id, academicPolicy.rulesetVersion),
    ),
  );
  const inputs: CourseSetInputs = {
    courses: courses.map((course, index) => ({ course, rule: rules[index] ?? null })),
    creditSelections: request.creditSelections ?? [],
    revision: records.revision,
    audit,
    catalog,
    academicPolicy,
    termCalendar,
    maxSkewMs: dependencies.maxSkewMs,
  };
  return { scope, inputs, sections };
}

/**
 * Creates the course set inputs service.
 *
 * @param dependencies - Access, pinned records and sections, catalog, rule, policy, and term
 *   repositories, and the configured skew and ruleset.
 * @returns A {@link CourseSetInputsService}.
 */
export function createCourseSetInputsService(
  dependencies: CourseSetInputsServiceDependencies,
): CourseSetInputsService {
  return {
    async load(actor, request, context) {
      const { scope, inputs } = await loadCourseSet(dependencies, { actor, request, context }, () =>
        Promise.resolve(null),
      );
      return { scope, inputs };
    },

    loadForTerm(actor, request, context) {
      return loadCourseSet(dependencies, { actor, request, context }, (scope) =>
        dependencies.pinnedSections.load(scope, request.termId),
      );
    },

    verify(loaded, operation) {
      try {
        return verifyCourseSet(loaded.inputs);
      } catch (error) {
        throw toTypedError(loaded.scope, operation, error);
      }
    },

    toTypedError,
  };
}
