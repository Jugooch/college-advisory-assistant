/**
 * @file Revalidates a plan draft: replays the latest revision's stored inputs on the current
 * sources and appends a `REVALIDATED` revision. Earlier revisions are never changed (ADR-0013 §4).
 * @module @caa/api/modules/plan-revalidation/plan-revalidation.service
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { PlanView, RevalidatePlanRequest, ScheduleOptionsRequest } from '@caa/api-contract';
import type { PlanRepository, StoredPlanRevision } from '@caa/db';
import { type Actor, type Plan, type PlanId, PlanRevisionCause, type StudentId } from '@caa/domain';

import { NotFoundError, RevisionConflictError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import type { AccessService } from '../access/access.service';
import type { PlanRevisionsService } from '../plan-revisions/plan-revisions.service';
import { carryOverSelection } from './plan-revalidation.logic';

/** Dependencies of the plan revalidation service. */
export interface PlanRevalidationServiceDependencies {
  readonly access: Pick<AccessService, 'canSavePlan'>;
  readonly plans: Pick<PlanRepository, 'findPlan' | 'findRevision'>;
  /** Replays schedule options and records the verified revision. */
  readonly revisions: PlanRevisionsService;
}

/** What a revalidation is for: the path student and plan, and the validated body. */
export interface RevalidatePlanQuery {
  readonly studentId: StudentId;
  readonly planId: PlanId;
  readonly body: RevalidatePlanRequest;
}

/** Revalidates plan drafts. */
export interface PlanRevalidationService {
  /**
   * Replays the latest revision's stored inputs on the current sources and appends a
   * `REVALIDATED` revision. The earlier selection carries over only if the same section set is
   * among the new options; otherwise it is null.
   *
   * @param actor - Authenticated actor from the session; must be the student themself.
   * @param query - The path student and plan, and the validated body.
   * @param context - Request-scoped values; log lines carry opaque IDs only.
   * @returns The plan with its new latest revision.
   * @throws {NotFoundError} When the actor isn't the student, or the student or plan is missing
   *   or belongs to another student.
   * @throws {RevisionConflictError} When `expectedRevision` isn't the latest revision, or another
   *   write raced this one, or the replay's audit check conflicts. Nothing is written.
   * @throws {StaleSourceError} When the current sources are stale or tied. Nothing is written.
   * @throws {SourceUnavailableError} When a current source is missing. Nothing is written.
   * @throws {Error} When the saved plan's revision history has a gap, or a stored revision
   *   breaks the revision view contract.
   */
  revalidatePlan(
    actor: Actor,
    query: RevalidatePlanQuery,
    context: RequestContext,
  ): Promise<PlanView>;
}

/**
 * Finds the student's own plan and its latest revision, and checks the client saw that revision.
 *
 * @param plans - The plan repository.
 * @param call - The tenant from the session and the path student, plan, and revision seen.
 * @returns The plan and its latest stored revision.
 * @throws {NotFoundError} When the plan or its revision is missing or another student's.
 * @throws {RevisionConflictError} When the latest revision isn't the one the client saw.
 */
async function findLatestToRevalidate(
  plans: PlanRevalidationServiceDependencies['plans'],
  call: { readonly actor: Actor; readonly query: RevalidatePlanQuery },
): Promise<{ readonly plan: Plan; readonly latest: StoredPlanRevision }> {
  const { actor, query } = call;
  const plan = await plans.findPlan(actor.tenantId, query.planId);
  // SECURITY: a plan of another student is NOT_FOUND, not a leak of its existence.
  if (plan?.studentId !== query.studentId) {
    throw new NotFoundError();
  }
  const latest = await plans.findRevision(actor.tenantId, plan.id, 'LATEST');
  if (latest === null) {
    throw new NotFoundError();
  }
  // SAFETY: revalidating from a revision the student did not see would hide a newer one.
  if (latest.revision.revision !== query.body.expectedRevision) {
    throw new RevisionConflictError();
  }
  return { plan, latest };
}

/**
 * Creates the plan revalidation service.
 *
 * @param dependencies - The access rule, the plan repository, and the plan revisions service.
 * @returns A {@link PlanRevalidationService}.
 */
export function createPlanRevalidationService(
  dependencies: PlanRevalidationServiceDependencies,
): PlanRevalidationService {
  const { access, plans, revisions } = dependencies;
  return {
    async revalidatePlan(actor, query, context) {
      // SECURITY: revalidating authors a revision, so it is the student's own record only; every
      // other actor gets the same NOT_FOUND as for a save (ADR-0013 §5).
      if (!(await access.canSavePlan(actor, query.studentId, context))) {
        throw new NotFoundError();
      }
      const { plan, latest } = await findLatestToRevalidate(plans, { actor, query });
      const stored = latest.revision;
      // NOTE: the inputs are the stored revision's, never the client's; only the pins are new.
      const request: ScheduleOptionsRequest = {
        termId: stored.termId,
        courseIds: stored.courseIds,
        creditSelections: stored.creditSelections,
        constraints: stored.constraints,
      };
      const replay = await revisions.replay(
        {
          actor,
          studentId: query.studentId,
          request,
          expectedPins: null,
          choose: (result) => carryOverSelection(result, stored.selectedSectionIds),
        },
        context,
      );
      return revisions.record(
        {
          actor,
          request,
          replay,
          cause: PlanRevisionCause.Revalidated,
          message: 'plan draft revalidated',
          target: { kind: 'NEXT_REVISION', plan, expectedRevision: stored.revision },
        },
        context,
      );
    },
  };
}
