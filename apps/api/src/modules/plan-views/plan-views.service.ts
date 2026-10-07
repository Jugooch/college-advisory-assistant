/**
 * @file Reads saved plans for a student the actor may see, each revision with its freshness
 * derived at read time. A source outage never hides the historical revision (AC14, NFR-05).
 * @module @caa/api/modules/plan-views/plan-views.service
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-05
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { PlanListResponse, PlanRevisionView, PlanView } from '@caa/api-contract';
import type { PlanRepository, StoredPlanRevision } from '@caa/db';
import type { Actor, Plan, PlanId, StudentId } from '@caa/domain';

import { NotFoundError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import type { AccessService } from '../access/access.service';
import type { PlanFreshnessService } from '../plan-freshness/plan-freshness.service';
import { toRevisionView } from './plan-views.mapper';

/** Dependencies of the plan views service. */
export interface PlanViewsServiceDependencies {
  readonly access: Pick<AccessService, 'canViewStudent'>;
  readonly plans: PlanRepository;
  readonly freshness: PlanFreshnessService;
}

/** Which plan of which student a read is for. */
export interface PlanQuery {
  readonly studentId: StudentId;
  readonly planId: PlanId;
}

/** Which revision of which plan of which student a read is for. */
export interface RevisionQuery extends PlanQuery {
  /** The revision number, from 1. */
  readonly revision: number;
}

/** Plan reads. */
export interface PlanViewsService {
  /**
   * Lists one row per term: the latest revision's outcome, its freshness, and the open case.
   *
   * @param actor - Authenticated actor from the session.
   * @param studentId - Internal student ID from the path.
   * @param context - Request-scoped values.
   * @returns The student's plans, newest first.
   * @throws {NotFoundError} When the actor may not see the student.
   */
  listPlans(actor: Actor, studentId: StudentId, context: RequestContext): Promise<PlanListResponse>;

  /**
   * Reads a plan: the latest revision in full and the index of every revision.
   *
   * @param actor - Authenticated actor from the session.
   * @param query - The path student and plan.
   * @param context - Request-scoped values.
   * @returns The plan view.
   * @throws {NotFoundError} When the student or plan is missing or the actor may not see it.
   * @throws {Error} When the plan's revision history has a gap, or a stored revision breaks the
   *   revision view contract.
   */
  getPlan(actor: Actor, query: PlanQuery, context: RequestContext): Promise<PlanView>;

  /**
   * Reads one historical revision with its freshness at read time.
   *
   * @param actor - Authenticated actor from the session.
   * @param query - The path student, plan, and revision number.
   * @param context - Request-scoped values.
   * @returns The revision view, as stored.
   * @throws {NotFoundError} When the student, plan, or revision is missing or not visible.
   */
  getRevision(
    actor: Actor,
    query: RevisionQuery,
    context: RequestContext,
  ): Promise<PlanRevisionView>;

  /**
   * Builds the view of a plan the caller has already authorized, for the save response.
   *
   * @param actor - Authenticated actor from the session.
   * @param plan - The plan, in the actor's tenant.
   * @param context - Request-scoped values.
   * @returns The plan view.
   * @throws {NotFoundError} When the plan has no revision.
   * @throws {Error} When the plan's revision history has a gap, or a stored revision breaks the
   *   revision view contract.
   */
  viewOf(actor: Actor, plan: Plan, context: RequestContext): Promise<PlanView>;
}

/** Building blocks of the reads, shared by the service methods. */
interface ViewHelpers {
  readonly assertCanView: (
    actor: Actor,
    studentId: StudentId,
    context: RequestContext,
  ) => Promise<void>;
  readonly findPlan: (actor: Actor, query: PlanQuery) => Promise<Plan>;
  readonly viewRevision: (
    actor: Actor,
    target: { readonly plan: Plan; readonly stored: StoredPlanRevision },
    context: RequestContext,
  ) => Promise<PlanRevisionView>;
  readonly viewOf: PlanViewsService['viewOf'];
}

/**
 * Creates the helpers that check access, find a plan, and build revision and plan views.
 *
 * @param dependencies - Access rule, plan repository, and freshness service.
 * @returns The helpers.
 */
function createViewHelpers(dependencies: PlanViewsServiceDependencies): ViewHelpers {
  const { access, plans, freshness } = dependencies;

  const assertCanView = async (actor: Actor, studentId: StudentId, context: RequestContext) => {
    // SECURITY: denied and missing are the same NOT_FOUND, so existence isn't revealed.
    if (!(await access.canViewStudent(actor, studentId, context))) {
      throw new NotFoundError();
    }
  };

  const findPlan = async (actor: Actor, query: PlanQuery): Promise<Plan> => {
    const plan = await plans.findPlan(actor.tenantId, query.planId);
    // SECURITY: a plan of another student is NOT_FOUND, not a leak of its existence.
    if (plan?.studentId !== query.studentId) {
      throw new NotFoundError();
    }
    return plan;
  };

  const viewRevision = async (
    actor: Actor,
    target: { readonly plan: Plan; readonly stored: StoredPlanRevision },
    context: RequestContext,
  ): Promise<PlanRevisionView> => {
    const { plan, stored } = target;
    const assessment = await freshness.assess(
      actor,
      { studentId: plan.studentId, revision: stored.revision },
      context,
    );
    return toRevisionView(stored, assessment, context);
  };

  const viewOf = async (actor: Actor, plan: Plan, context: RequestContext): Promise<PlanView> => {
    const latest = await plans.findRevision(actor.tenantId, plan.id, 'LATEST');
    if (latest === null) {
      throw new NotFoundError();
    }
    const earlier = await Promise.all(
      Array.from({ length: latest.revision.revision - 1 }, (_unused, index) =>
        plans.findRevision(actor.tenantId, plan.id, index + 1),
      ),
    );
    // SAFETY: history is shown whole or not at all, so a gap is a defect, never a shorter list.
    if (earlier.includes(null)) {
      throw new Error('Plan revision history has a gap');
    }
    const history = [...earlier, latest].flatMap((entry) => (entry === null ? [] : [entry]));
    return {
      id: plan.id,
      termId: plan.termId,
      createdAt: plan.createdAt,
      latest: await viewRevision(actor, { plan, stored: latest }, context),
      revisions: history.map(({ revision }) => ({
        revision: revision.revision,
        cause: revision.cause,
        createdAt: revision.createdAt,
      })),
    };
  };

  return { assertCanView, findPlan, viewRevision, viewOf };
}

/**
 * Creates the plan views service.
 *
 * @param dependencies - Access rule, plan repository, and freshness service.
 * @returns A {@link PlanViewsService}.
 */
export function createPlanViewsService(
  dependencies: PlanViewsServiceDependencies,
): PlanViewsService {
  const { plans, freshness } = dependencies;
  const { assertCanView, findPlan, viewRevision, viewOf } = createViewHelpers(dependencies);
  return {
    async listPlans(actor, studentId, context) {
      await assertCanView(actor, studentId, context);
      const found = await plans.listForStudent(actor.tenantId, studentId);
      const summaries = await Promise.all(
        found.map(async ({ plan, latest }) => ({
          id: plan.id,
          termId: plan.termId,
          latestRevision: latest.revision.revision,
          createdAt: plan.createdAt,
          outcome: latest.revision.outcome,
          freshness: await freshness.assess(
            actor,
            { studentId, revision: latest.revision },
            context,
          ),
          // NOTE: advisor cases arrive with #411; until then no case is open.
          openCaseStatus: null,
        })),
      );
      return { plans: summaries };
    },

    async getPlan(actor, query, context) {
      await assertCanView(actor, query.studentId, context);
      return viewOf(actor, await findPlan(actor, query), context);
    },

    async getRevision(actor, query, context) {
      await assertCanView(actor, query.studentId, context);
      const plan = await findPlan(actor, query);
      const stored = await plans.findRevision(actor.tenantId, plan.id, query.revision);
      if (stored === null) {
        throw new NotFoundError();
      }
      return viewRevision(actor, { plan, stored }, context);
    },

    viewOf,
  };
}
