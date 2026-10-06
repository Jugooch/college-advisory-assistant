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
import type { CourseDisplay } from '@caa/api-contract';
import type { Actor, CourseId, StudentId } from '@caa/domain';

import type { RequestContext } from '../../shared/request-context';
import { selectCourseDisplays } from '../course-display/course-display.logic';
import type { CourseSetInputsService } from '../course-set-inputs/course-set-inputs.service';
import type { CourseChecks } from '../course-verification/course-verification.logic';

/** Names course checks in log lines. */
const OPERATION = 'course checks';

/** Dependencies of the course checks service. */
export interface CourseChecksServiceDependencies {
  /** Applies the access rule, loads and refuses pinned inputs, and runs the checks. */
  readonly courseSetInputs: CourseSetInputsService;
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

/** The checks of a candidate set, and the catalog display entries of its courses. */
export interface CourseChecksResult extends CourseChecks {
  /** Code and credit rule of each checked course, from the session tenant's catalog (#151). */
  readonly courses: readonly CourseDisplay[];
}

/** Course checks, each gated by the students service's access rule. */
export interface CourseChecksService {
  /**
   * Checks a candidate course set for one student the actor may see.
   *
   * @param actor - Authenticated actor from the session.
   * @param query - The path student, and the courses and credit choices from the validated body.
   * @param context - Request-scoped values; every log line carries the request ID.
   * @returns Per-course and set checks from the engine, their aggregate, the pinned inputs, and
   *   the checked courses' catalog display entries.
   * @throws {NotFoundError} When the student doesn't exist, the actor may not see them, or a
   *   loaded record belongs to another tenant or student.
   * @throws {SourceUnavailableError} When the student has no snapshot or no audit, the active
   *   ruleset has no policy, or the engine rejects stored catalog, policy, or record data.
   * @throws {StaleSourceError} When two snapshots or two audits are tied for latest, or the
   *   record or the audit's record time is older than the maximum source age.
   * @throws {InvalidRequestError} When a course isn't in the tenant's catalog, or the engine
   *   rejects the requested courses or credit choices.
   * @throws {RulesetNotConfiguredError} When no active ruleset is configured.
   * @throws {InconsistentInputsError} When the loaded rule and policy contradict each other.
   */
  checkCourses(
    actor: Actor,
    query: CourseChecksQuery,
    context: RequestContext,
  ): Promise<CourseChecksResult>;
}

/**
 * Creates the course checks service.
 *
 * @param dependencies - The shared course set loader.
 * @returns A {@link CourseChecksService}.
 */
export function createCourseChecksService(
  dependencies: CourseChecksServiceDependencies,
): CourseChecksService {
  const { courseSetInputs } = dependencies;
  return {
    async checkCourses(actor, query, context) {
      // SECURITY: the loader applies the access rule first, and reads every input for the
      // session's tenant; nothing comes from the body except course IDs and credit choices.
      const loaded = await courseSetInputs.load(actor, { ...query, operation: OPERATION }, context);
      const checks = courseSetInputs.verify(loaded, OPERATION);
      context.logger.info(
        {
          actorUserId: actor.userId,
          tenantId: actor.tenantId,
          studentId: loaded.scope.studentId,
          ...checks.pinnedInputs,
          courseCount: loaded.inputs.courses.length,
          aggregate: checks.aggregate,
        },
        'course checks run',
      );
      return { ...checks, courses: selectCourseDisplays(query.courseIds, loaded.inputs.catalog) };
    },
  };
}
