/**
 * @file Finds up to three schedule options for one student on pinned inputs, bounded by the
 * solver work cap, synchronously (ADR-0010).
 * @module @caa/api/modules/schedule-options/schedule-options.service
 * @requirement FR-02
 * @requirement FR-07
 * @requirement FR-08
 * @requirement FR-09
 * @requirement FR-10
 * @requirement FR-18
 * @requirement NFR-01
 * @requirement NFR-04
 * @requirement NFR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/07-system-architecture-and-design.md
 */
import { createHash } from 'node:crypto';

import {
  namedCampusIds,
  type ScheduleOptionsRequest,
  type ScheduleOptionsResponse,
} from '@caa/api-contract';
import type { CampusRepository } from '@caa/db';
import { type Actor, CampusIdSchema, type StudentId } from '@caa/domain';
import { normalizeScheduleRequest, type ScheduleSolution } from '@caa/engine';

import { SourceUnavailableError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import type {
  CourseSetInputsService,
  LoadedScheduleSet,
} from '../course-set-inputs/course-set-inputs.service';
import {
  type ScheduleOptionsBody,
  selectCampusDisplays,
  solveScheduleOptions,
  toScheduleOptionsResponse,
  toTermDisplay,
} from './schedule-options.logic';

/** Names schedule options in log lines. */
const OPERATION = 'schedule options';

/** Dependencies of the schedule options service. */
export interface ScheduleOptionsServiceDependencies {
  /** Applies the access rule, loads and refuses pinned inputs, and runs the course checks. */
  readonly courseSetInputs: CourseSetInputsService;
  /** Names the campuses a response contains, for display only. */
  readonly campuses: CampusRepository;
  /** Read only to log how long the solver took; never to stop it (ADR-0010 §1). */
  readonly now: () => Date;
  /** Validated `SCHEDULE_SOLVER_WORK_CAP`. */
  readonly workCap: number;
}

/** What the caller asks for: the path student and the body. Identity is never part of it. */
export interface ScheduleOptionsQuery extends ScheduleOptionsRequest {
  /** Internal student ID from the path. */
  readonly studentId: StudentId;
}

/** Schedule options, each gated by the students service's access rule. */
export interface ScheduleOptionsService {
  /**
   * Finds schedule options for one student the actor may see.
   *
   * @param actor - Authenticated actor from the session.
   * @param query - The path student, and the term, courses, credit choices, and constraints from
   *   the validated body.
   * @param context - Request-scoped values; every log line carries the request ID.
   * @returns The outcome, the options or the evidence there are none, and the pinned inputs.
   * @throws {NotFoundError} When the student doesn't exist, the actor may not see them, or a
   *   loaded record or section snapshot is out of scope.
   * @throws {SourceUnavailableError} When the student has no snapshot or no audit, the term has
   *   no published section snapshot or no calendar entry, a named campus has no row, the ruleset has no policy, or stored data is unusable.
   * @throws {StaleSourceError} When a record, audit, or section snapshot is tied for latest or
   *   older than the maximum source age.
   * @throws {InvalidRequestError} When a course isn't in the tenant's catalog, or the engine
   *   rejects the requested courses, credit choices, or constraints.
   * @throws {RulesetNotConfiguredError} When no active ruleset is configured.
   * @throws {InconsistentInputsError} When the loaded inputs contradict each other.
   */
  findOptions(
    actor: Actor,
    query: ScheduleOptionsQuery,
    context: RequestContext,
  ): Promise<ScheduleOptionsResponse>;
}

/**
 * Hashes the normalized request (ADR-0010 §7).
 *
 * @param request - The validated body.
 * @returns `sha256:` and the lowercase hex digest.
 */
function hashRequest(request: ScheduleOptionsRequest): string {
  const digest = createHash('sha256').update(normalizeScheduleRequest(request)).digest('hex');
  return `sha256:${digest}`;
}

/** What the display data is read from. */
interface DisplayCall {
  readonly actor: Actor;
  readonly loaded: LoadedScheduleSet;
  readonly request: ScheduleOptionsRequest;
  readonly body: ScheduleOptionsBody;
}

/**
 * Adds the requested term and the names of the campuses the response contains. Display only.
 *
 * @param repository - The campus repository.
 * @param call - The actor, the pinned inputs, the request, and the response body.
 * @param context - Request-scoped values.
 * @returns The response with `term` and `campuses`.
 * @throws {SourceUnavailableError} When the term has no calendar entry or a named campus has no row.
 */
async function withDisplayData(
  repository: CampusRepository,
  call: DisplayCall,
  context: RequestContext,
): Promise<ScheduleOptionsResponse> {
  const { actor, body } = call;
  const term = call.loaded.inputs.termCalendar.find((entry) => entry.id === call.request.termId);
  if (term === undefined) {
    context.logger.warn({ termId: call.request.termId }, 'term missing from calendar');
    throw new SourceUnavailableError();
  }
  const namedIds = namedCampusIds(body);
  // SECURITY: campuses are read for the session's tenant. Names are display only and never
  // reach the engine, ranking or pinned inputs (ADR-0010 Amendment 7).
  const loaded = await repository.findByIds(
    actor.tenantId,
    namedIds.map((id) => CampusIdSchema.parse(id)),
  );
  const { campuses, missingIds } = selectCampusDisplays(namedIds, loaded);
  // SAFETY: a named campus with no row is a source failure, never a dropped or guessed name.
  if (missingIds.length > 0) {
    context.logger.warn({ tenantId: actor.tenantId, campusIds: missingIds }, 'campus missing');
    throw new SourceUnavailableError();
  }
  return { ...body, term: toTermDisplay(term), campuses };
}

/**
 * Creates the schedule options service.
 *
 * @param dependencies - The shared course set loader, the clock, and the work cap.
 * @returns A {@link ScheduleOptionsService}.
 */
export function createScheduleOptionsService(
  dependencies: ScheduleOptionsServiceDependencies,
): ScheduleOptionsService {
  const { courseSetInputs, now, workCap } = dependencies;
  /**
   * Runs the solver, turning its input errors into a typed error for whoever caused them.
   *
   * @param loaded - The pinned inputs.
   * @param request - The validated body.
   * @returns The solver's answer.
   */
  function solve(loaded: LoadedScheduleSet, request: ScheduleOptionsRequest): ScheduleSolution {
    const { inputs, sections } = loaded;
    try {
      return solveScheduleOptions({
        courses: inputs.courses.map(({ course }) => course),
        catalog: inputs.catalog,
        snapshot: sections.snapshot,
        transitionPolicy: sections.transitionPolicy,
        academicPolicy: inputs.academicPolicy,
        // SAFETY: every course of a bundle, linked ones included; a missing linked rule would
        // silently drop that course's linkedCourseResults entry (ADR-0010 Amendment 4).
        prerequisiteRules: loaded.bundleRules,
        request,
        workCap,
      });
    } catch (error) {
      throw courseSetInputs.toTypedError(loaded.scope, OPERATION, error);
    }
  }

  return {
    async findOptions(actor, query, context) {
      const { studentId, ...request } = query;
      // SECURITY: the loader applies the access rule first, and reads every input for the
      // session's tenant; the body supplies only the term, courses, credits, and constraints.
      const loaded = await courseSetInputs.loadForTerm(
        actor,
        { operation: OPERATION, studentId, ...request },
        context,
      );
      // SAFETY: the academic checks don't depend on sections, so they run once and every option
      // carries them (ADR-0010 §2).
      const checks = courseSetInputs.verify(loaded, OPERATION);
      const startedAt = now().getTime();
      const solution = solve(loaded, request);
      context.logger.info(
        {
          actorUserId: actor.userId,
          tenantId: actor.tenantId,
          studentId: loaded.scope.studentId,
          sectionSnapshotId: loaded.sections.snapshot.id,
          courseCount: request.courseIds.length,
          outcome: solution.outcome,
          optionCount: solution.options.length,
          workUsed: solution.workUsed,
          workCap: solution.workCap,
          solverDurationMs: now().getTime() - startedAt,
        },
        'schedule options run',
      );
      const body = toScheduleOptionsResponse({
        request,
        solution,
        checks,
        catalog: loaded.inputs.catalog,
        snapshot: loaded.sections.snapshot,
        transitionPolicy: loaded.sections.transitionPolicy,
        constraintHash: hashRequest(request),
      });
      return withDisplayData(dependencies.campuses, { actor, loaded, request, body }, context);
    },
  };
}
