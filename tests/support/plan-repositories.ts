/**
 * @file QA-owned in-memory plan repository for the API acceptance harness. It follows the
 * documented `@caa/db` repository contract (tenant filter, one plan per student and term,
 * append-only revisions, `expectedRevision` conflicts), written here from that contract and not
 * copied from anyone's fakes, so the acceptance oracle stays independent of the code under test.
 * @module @caa/tests/support/plan-repositories
 * @requirement FR-11
 * @see docs/standards/07-testing.md
 */
import type { NewPlanRevision, PlanRepository, StoredPlanRevision } from '@caa/db';
import { createPlan, createPlanRevision, type Plan } from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

/** Plan backing data. A field that is omitted means nothing of that kind is stored. */
export interface PlanWorld {
  /** Plans of every tenant. */
  plans?: readonly Plan[];
  /** Every revision of every plan, oldest first. */
  planRevisions?: readonly StoredPlanRevision[];
}

/** The plan repository the harness gives the API's `Repositories` under the `plans` key. */
export interface PlanRepositories {
  readonly plans: PlanRepository;
}

/**
 * Lists a plan's revisions, oldest first.
 *
 * @param world - Backing data.
 * @param plan - The plan.
 * @returns Its revisions.
 */
function revisionsOf(world: PlanWorld, plan: Plan): StoredPlanRevision[] {
  return (world.planRevisions ?? [])
    .filter(({ revision }) => revision.planId === plan.id)
    .toSorted((left, right) => left.revision.revision - right.revision.revision);
}

/**
 * Stores a plan's next revision.
 *
 * @param world - Backing data.
 * @param next - The plan, the number, and the revision fields and result to store.
 * @returns The stored revision.
 */
function storeRevision(
  world: PlanWorld,
  next: { readonly plan: Plan; readonly number: number; readonly fields: NewPlanRevision },
): StoredPlanRevision {
  const { result, ...fields } = next.fields;
  const stored: StoredPlanRevision = {
    revision: createPlanRevision({
      ...fields,
      id: syntheticId('planRevision', (world.planRevisions ?? []).length + 1),
      planId: next.plan.id,
      revision: next.number,
    }),
    result,
  };
  world.planRevisions = [...(world.planRevisions ?? []), stored];
  return stored;
}

/**
 * Creates the plan repository over the world.
 *
 * @param world - Backing data. Read and replaced on every call, so a case can inspect it.
 * @returns The plan repositories.
 */
export function createPlanRepositories(world: PlanWorld): PlanRepositories {
  const findPlan = (tenantId: string, planId: string): Plan | null =>
    (world.plans ?? []).find((plan) => plan.tenantId === tenantId && plan.id === planId) ?? null;
  const plans: PlanRepository = {
    createWithFirstRevision: (tenantId, newPlan, firstRevision) => {
      const isTaken = (world.plans ?? []).some(
        (plan) =>
          plan.tenantId === tenantId &&
          plan.studentId === newPlan.studentId &&
          plan.termId === newPlan.termId,
      );
      if (isTaken) {
        return Promise.resolve({ status: 'PLAN_EXISTS' });
      }
      const id = syntheticId('plan', (world.plans ?? []).length + 1);
      const plan = createPlan({ ...newPlan, id, tenantId });
      world.plans = [...(world.plans ?? []), plan];
      const revision = storeRevision(world, { plan, number: 1, fields: firstRevision });
      return Promise.resolve({ status: 'CREATED', plan, revision });
    },
    appendRevision: (tenantId, planId, request) => {
      const plan = findPlan(tenantId, planId);
      if (plan === null) {
        return Promise.resolve({ status: 'PLAN_NOT_FOUND' });
      }
      if (revisionsOf(world, plan).length !== request.expectedRevision) {
        return Promise.resolve({ status: 'REVISION_CONFLICT' });
      }
      const number = request.expectedRevision + 1;
      const revision = storeRevision(world, { plan, number, fields: request.revision });
      return Promise.resolve({ status: 'APPENDED', revision });
    },
    findPlan: (tenantId, planId) => Promise.resolve(findPlan(tenantId, planId)),
    findRevision: (tenantId, planId, revision) => {
      const plan = findPlan(tenantId, planId);
      const stored = plan === null ? [] : revisionsOf(world, plan);
      return Promise.resolve(
        (revision === 'LATEST'
          ? stored.at(-1)
          : stored.find((entry) => entry.revision.revision === revision)) ?? null,
      );
    },
    listForStudent: (tenantId, studentId) =>
      Promise.resolve(
        (world.plans ?? [])
          .filter((plan) => plan.tenantId === tenantId && plan.studentId === studentId)
          .toSorted((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
          .flatMap((plan) => {
            const latest = revisionsOf(world, plan).at(-1);
            return latest === undefined ? [] : [{ plan, latest }];
          }),
      ),
  };
  return { plans };
}
