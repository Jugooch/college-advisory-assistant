/**
 * @file In-memory fake of the plan repository for API tests, with the same tenant filter,
 * one-plan-per-term rule, and append-only revision numbering as PostgreSQL. Test code only;
 * never wired by the container.
 * @module @caa/api/testing/in-memory-plan-repositories
 * @see docs/standards/07-testing.md
 */
import type { NewPlanRevision, PlanRepository, StoredPlanRevision } from '@caa/db';
import { createPlan, createPlanRevision, type Plan } from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

/** Plan backing data. Every field omitted means none stored. */
export interface InMemoryPlanStore {
  plans?: readonly Plan[];
  /** Every revision of every plan, oldest first. */
  planRevisions?: readonly StoredPlanRevision[];
}

/**
 * Finds a plan's revisions, oldest first.
 *
 * @param store - Backing data.
 * @param plan - The plan.
 * @returns Its revisions.
 */
function revisionsOf(store: InMemoryPlanStore, plan: Plan): StoredPlanRevision[] {
  return (store.planRevisions ?? [])
    .filter(({ revision }) => revision.planId === plan.id)
    .toSorted((left, right) => left.revision.revision - right.revision.revision);
}

/**
 * Stores a plan's next revision in the store.
 *
 * @param store - Backing data.
 * @param next - The plan, the number, and the revision fields and result to store.
 * @returns The stored revision.
 */
function storeRevision(
  store: InMemoryPlanStore,
  next: { readonly plan: Plan; readonly number: number; readonly fields: NewPlanRevision },
): StoredPlanRevision {
  const { result, ...fields } = next.fields;
  const stored = {
    revision: createPlanRevision({
      ...fields,
      id: syntheticId('planRevision', (store.planRevisions ?? []).length + 1),
      planId: next.plan.id,
      revision: next.number,
    }),
    result,
  };
  store.planRevisions = [...(store.planRevisions ?? []), stored];
  return stored;
}

/**
 * Creates the plan repository over the store, filtered by tenant like PostgreSQL.
 *
 * @param store - Backing data. Read and replaced on every call.
 * @returns A {@link PlanRepository}.
 */
export function createInMemoryPlanRepository(store: InMemoryPlanStore): PlanRepository {
  const findPlan = (tenantId: string, planId: string): Plan | null =>
    (store.plans ?? []).find((plan) => plan.tenantId === tenantId && plan.id === planId) ?? null;
  return {
    createWithFirstRevision: (tenantId, newPlan, firstRevision) => {
      const isTaken = (store.plans ?? []).some(
        (plan) =>
          plan.tenantId === tenantId &&
          plan.studentId === newPlan.studentId &&
          plan.termId === newPlan.termId,
      );
      if (isTaken) {
        return Promise.resolve({ status: 'PLAN_EXISTS' });
      }
      const id = syntheticId('plan', (store.plans ?? []).length + 1);
      const plan = createPlan({ ...newPlan, id, tenantId });
      store.plans = [...(store.plans ?? []), plan];
      const revision = storeRevision(store, { plan, number: 1, fields: firstRevision });
      return Promise.resolve({ status: 'CREATED', plan, revision });
    },
    appendRevision: (tenantId, planId, request) => {
      const plan = findPlan(tenantId, planId);
      if (plan === null) {
        return Promise.resolve({ status: 'PLAN_NOT_FOUND' });
      }
      if (revisionsOf(store, plan).length !== request.expectedRevision) {
        return Promise.resolve({ status: 'REVISION_CONFLICT' });
      }
      const number = request.expectedRevision + 1;
      const revision = storeRevision(store, { plan, number, fields: request.revision });
      return Promise.resolve({ status: 'APPENDED', revision });
    },
    findPlan: (tenantId, planId) => Promise.resolve(findPlan(tenantId, planId)),
    findRevision: (tenantId, planId, revision) => {
      const plan = findPlan(tenantId, planId);
      const stored = plan === null ? [] : revisionsOf(store, plan);
      return Promise.resolve(
        (revision === 'LATEST'
          ? stored.at(-1)
          : stored.find((entry) => entry.revision.revision === revision)) ?? null,
      );
    },
    findRevisionById: (tenantId, revisionId) => {
      const stored = (store.planRevisions ?? []).find(({ revision }) => revision.id === revisionId);
      const plan = stored === undefined ? null : findPlan(tenantId, stored.revision.planId);
      return Promise.resolve(plan === null ? null : (stored ?? null));
    },
    listForStudent: (tenantId, studentId) =>
      Promise.resolve(
        (store.plans ?? [])
          .filter((plan) => plan.tenantId === tenantId && plan.studentId === studentId)
          .toSorted((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
          .flatMap((plan) => {
            const latest = revisionsOf(store, plan).at(-1);
            return latest === undefined ? [] : [{ plan, latest }];
          }),
      ),
  };
}
