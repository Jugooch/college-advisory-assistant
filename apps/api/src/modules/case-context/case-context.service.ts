/**
 * @file Finds the plan revision a case froze and shows it as stored, with its freshness at read
 * time. It looks the revision up by its own ID, so a newer revision of the plan is never shown.
 * @module @caa/api/modules/cases/case-context.service
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-15
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { PlanRevisionView } from '@caa/api-contract';
import type { PlanRepository } from '@caa/db';
import type { Actor, PlanId, PlanRevisionId, StudentId } from '@caa/domain';

import { NotFoundError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import type { PlanViewsService } from '../plan-views/plan-views.service';

/** Dependencies of the case context service. */
export interface CaseContextServiceDependencies {
  readonly plans: Pick<PlanRepository, 'findPlan' | 'findRevisionById'>;
  readonly views: Pick<PlanViewsService, 'getRevision'>;
}

/** The revision a case names, and the student it must belong to. */
export interface RevisionTarget {
  readonly studentId: StudentId;
  readonly planRevisionId: PlanRevisionId;
}

/** Where a revision sits: its plan and its number. */
interface RevisionPlace {
  readonly planId: PlanId;
  readonly revision: number;
}

/** Reads the frozen plan revision of a case. */
export interface CaseContextService {
  /**
   * Checks that the revision is one of the student's own, in the actor's tenant.
   *
   * @param actor - Authenticated actor; its tenant scopes the lookup.
   * @param target - The case's student and the revision it names.
   * @returns True when the student has a revision with that ID.
   */
  hasRevision(actor: Actor, target: RevisionTarget): Promise<boolean>;

  /**
   * Shows the revision exactly as stored, with its freshness derived now.
   *
   * @param actor - Authenticated actor who may see the student.
   * @param target - The case's student and the revision it names.
   * @param context - Request-scoped values.
   * @returns The revision view.
   * @throws {NotFoundError} When the student has no such revision.
   */
  contextOf(
    actor: Actor,
    target: RevisionTarget,
    context: RequestContext,
  ): Promise<PlanRevisionView>;
}

/**
 * Creates the case context service.
 *
 * @param dependencies - Plan repository and plan views.
 * @returns A {@link CaseContextService}.
 */
export function createCaseContextService(
  dependencies: CaseContextServiceDependencies,
): CaseContextService {
  const { plans, views } = dependencies;

  const locate = async (actor: Actor, target: RevisionTarget): Promise<RevisionPlace | null> => {
    const { studentId, planRevisionId } = target;
    // SECURITY: only this student's plans in the actor's tenant are searched, so another
    // student's or tenant's revision ID is simply not found.
    // TODO(#468): the interface method becomes required in step 3 of the adoption.
    if (plans.findRevisionById === undefined) {
      // Fail closed: reporting "not found" would hide a frozen revision from its case.
      throw new Error('the plan repository does not implement findRevisionById');
    }
    const stored = await plans.findRevisionById(actor.tenantId, planRevisionId);
    if (stored === null) {
      return null;
    }
    const plan = await plans.findPlan(actor.tenantId, stored.revision.planId);
    // SECURITY: a revision of another student's plan is simply not found.
    return plan?.studentId === studentId
      ? { planId: plan.id, revision: stored.revision.revision }
      : null;
  };

  return {
    async hasRevision(actor, target) {
      return (await locate(actor, target)) !== null;
    },

    async contextOf(actor, target, context) {
      const place = await locate(actor, target);
      if (place === null) {
        // SAFETY: a case whose revision can't be found has no context to show; the caller
        // decides whether that is a 404 or a defect.
        throw new NotFoundError();
      }
      return views.getRevision(actor, { studentId: target.studentId, ...place }, context);
    },
  };
}
