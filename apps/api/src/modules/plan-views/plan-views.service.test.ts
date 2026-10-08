/**
 * @file HTTP-level tests for the open case status in the plan list: OPEN for a new case,
 * IN_REVIEW once claimed, null once resolved or withdrawn, a case of another tenant ignored, the
 * case shown only on its own plan, and a case on an earlier revision still shown after a re-save.
 * @requirement FR-11
 * @requirement AC14
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { PlanListResponseSchema } from '@caa/api-contract';
import { CaseStatus, createPlan, createPlanRevision, Role } from '@caa/domain';
import {
  buildActor,
  buildPlan,
  buildPlanRevision,
  SYNTHETIC_TENANTS,
  syntheticId,
} from '@caa/test-kit';

import { buildCasesWorld, createAsStudent } from '../../testing/cases-harness';
import { createRecordingLogger } from '../../testing/in-memory-repositories';
import { getPlans } from '../../testing/plan-drafts-harness';
import { createPlanViewsService } from './plan-views.service';

const { app, store, reset } = buildCasesWorld();

beforeEach(reset);

/**
 * Reads the open case status of each listed plan.
 *
 * @returns The statuses by plan ID.
 */
async function listedStatuses(): Promise<Map<string, string | null>> {
  const response = await getPlans(app, '');
  expect(response.statusCode).toBe(200);
  const { data } = z.object({ data: PlanListResponseSchema }).parse(response.json());
  return new Map(data.plans.map((plan) => [plan.id, plan.openCaseStatus]));
}

/**
 * Reads the open case status of the student's only listed plan.
 *
 * @returns The status shown in the list.
 */
async function listedStatus(): Promise<unknown> {
  const [only] = (await listedStatuses()).values();
  return only;
}

/**
 * Sets the status of every stored case, as a claim, resolve, or withdraw would.
 *
 * @param status - The new status.
 */
function setStatus(status: CaseStatus): void {
  store.cases = (store.cases ?? []).map((entry) => ({ ...entry, status }));
}

describe('plan list: open case status', () => {
  it('is OPEN for a plan with a new case', async () => {
    await createAsStudent(app);

    expect(await listedStatus()).toBe('OPEN');
  });

  it('is IN_REVIEW once the case is claimed', async () => {
    await createAsStudent(app);
    setStatus(CaseStatus.InReview);

    expect(await listedStatus()).toBe('IN_REVIEW');
  });

  it.each([CaseStatus.Resolved, CaseStatus.Withdrawn])('is null once the case is %s', async (s) => {
    await createAsStudent(app);
    setStatus(s);

    expect(await listedStatus()).toBeNull();
  });

  it('is null for a plan with no case', async () => {
    await createAsStudent(app);
    store.cases = [];

    expect(await listedStatus()).toBeNull();
  });

  it("ignores another tenant's case", async () => {
    await createAsStudent(app);
    store.cases = (store.cases ?? []).map((entry) => ({
      ...entry,
      tenantId: SYNTHETIC_TENANTS.b.id,
    }));

    expect(await listedStatus()).toBeNull();
  });

  it('shows the case only on its own plan when the student has two plans', async () => {
    const created = await createAsStudent(app);
    const [plan] = store.plans ?? [];
    const [stored] = store.planRevisions ?? [];
    if (plan === undefined || stored === undefined) {
      throw new Error('Expected a saved plan');
    }
    const otherPlan = createPlan({
      ...plan,
      id: syntheticId('plan', 90),
      termId: syntheticId('term', 90),
    });
    const otherRevision = {
      ...stored,
      revision: createPlanRevision({
        ...stored.revision,
        id: syntheticId('planRevision', 90),
        planId: otherPlan.id,
      }),
    };
    store.plans = [...(store.plans ?? []), otherPlan];
    store.planRevisions = [...(store.planRevisions ?? []), otherRevision];

    const statuses = await listedStatuses();

    expect(created.planRevisionId).toBe(stored.revision.id);
    expect(statuses.get(plan.id)).toBe('OPEN');
    expect(statuses.get(otherPlan.id)).toBeNull();
  });

  it('still shows the case after the plan is re-saved as a later revision', async () => {
    await createAsStudent(app);
    const [stored] = store.planRevisions ?? [];
    if (stored === undefined) {
      throw new Error('Expected a saved revision');
    }
    store.planRevisions = [
      ...(store.planRevisions ?? []),
      {
        ...stored,
        revision: createPlanRevision({
          ...stored.revision,
          id: syntheticId('planRevision', 91),
          revision: 2,
        }),
      },
    ];

    expect(await listedStatus()).toBe('OPEN');
  });
});

describe('plan list: case lookup', () => {
  /**
   * Builds the service over stub plans, access, and freshness with the given case repository.
   *
   * @param cases - The case repository fake.
   * @returns The service and the plans it reads.
   */
  function serviceOver(cases: Parameters<typeof createPlanViewsService>[0]['cases']) {
    const plan = buildPlan();
    const listForStudent = vi.fn(() =>
      Promise.resolve([
        { plan, latest: { revision: buildPlanRevision({ planId: plan.id }), result: {} } },
      ]),
    );
    const service = createPlanViewsService({
      access: { canViewStudent: () => Promise.resolve(true) },
      plans: { listForStudent } as never,
      cases,
      freshness: { assess: () => Promise.resolve({ state: 'FRESH' }) } as never,
    });
    return { service, plan };
  }

  const actor = buildActor({ roles: [Role.Student] }, 1);

  it('reads every plan live case in one findLiveByPlanIds call, never per revision', async () => {
    const findLiveByPlanIds = vi.fn(() => Promise.resolve(new Map()));
    const { service, plan } = serviceOver({ findLiveByPlanIds });

    await service.listPlans(actor, plan.studentId, { logger: createRecordingLogger() });

    expect(findLiveByPlanIds).toHaveBeenCalledExactlyOnceWith(actor.tenantId, [plan.id]);
  });

  it('fails closed when the repository has no findLiveByPlanIds', async () => {
    const { service, plan } = serviceOver({});

    await expect(
      service.listPlans(actor, plan.studentId, { logger: createRecordingLogger() }),
    ).rejects.toThrow('findLiveByPlanIds');
  });
});
