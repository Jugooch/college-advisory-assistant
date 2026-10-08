/**
 * @file Integration tests for finding the live case of each plan against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CaseAction, CaseStatus, type PlanId } from '@caa/domain';

import {
  buildClaim,
  buildNewCase,
  buildResolve,
  type CaseWorld,
  insertCaseWorld,
} from '../testing/case-fixtures';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { createAdvisingCaseRepository } from './advising-case.repository';
import { createPlanRepository } from './plan.repository';

describe('AdvisingCaseRepository findLiveByPlanIds', () => {
  let testDatabase: TestDatabase;
  let cases: ReturnType<typeof createAdvisingCaseRepository>;

  beforeAll(() => {
    testDatabase = openTestDatabase();
    cases = createAdvisingCaseRepository(testDatabase.db);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const newWorld = async (label: string): Promise<CaseWorld> =>
    insertCaseWorld(testDatabase.db, await insertTenant(testDatabase.db), label);

  const planOf = async (world: CaseWorld): Promise<PlanId> => {
    const [listed] = await createPlanRepository(testDatabase.db).listForStudent(
      world.tenantId,
      world.studentId,
    );
    if (!listed) {
      throw new Error('expected the world to have a plan');
    }
    return listed.plan.id;
  };

  const createCase = async (world: CaseWorld) => {
    const created = await cases.create(world.tenantId, buildNewCase(world));
    if (created.status !== 'CREATED') {
      throw new Error('expected the case to be created');
    }
    return created.case;
  };

  it('returns the open case, then the in-review case, keyed by plan', async () => {
    const world = await newWorld('live');
    const planId = await planOf(world);
    const opened = await createCase(world);

    expect((await cases.findLiveByPlanIds(world.tenantId, [planId])).get(planId)).toEqual(opened);

    await cases.appendEvent(world.tenantId, opened.id, {
      expectedSequence: 1,
      event: buildClaim(world.userId),
    });
    const live = await cases.findLiveByPlanIds(world.tenantId, [planId]);

    expect(live.get(planId)?.status).toBe(CaseStatus.InReview);
  });

  it('has no entry for resolved or withdrawn cases, or a plan without one', async () => {
    const resolvedWorld = await newWorld('resolved');
    const withdrawnWorld = await newWorld('withdrawn');
    const emptyWorld = await newWorld('empty');
    const resolvedPlan = await planOf(resolvedWorld);
    const withdrawnPlan = await planOf(withdrawnWorld);
    const emptyPlan = await planOf(emptyWorld);
    const toResolve = await createCase(resolvedWorld);
    await cases.appendEvent(resolvedWorld.tenantId, toResolve.id, {
      expectedSequence: 1,
      event: buildClaim(resolvedWorld.userId),
    });
    await cases.appendEvent(resolvedWorld.tenantId, toResolve.id, {
      expectedSequence: 2,
      event: buildResolve(resolvedWorld.userId),
    });
    const toWithdraw = await createCase(withdrawnWorld);
    await cases.appendEvent(withdrawnWorld.tenantId, toWithdraw.id, {
      expectedSequence: 1,
      event: {
        ...buildClaim(withdrawnWorld.userId),
        action: CaseAction.Withdraw,
        toStatus: CaseStatus.Withdrawn,
      },
    });

    expect((await cases.findLiveByPlanIds(resolvedWorld.tenantId, [resolvedPlan])).size).toBe(0);
    expect((await cases.findLiveByPlanIds(withdrawnWorld.tenantId, [withdrawnPlan])).size).toBe(0);
    expect((await cases.findLiveByPlanIds(emptyWorld.tenantId, [emptyPlan])).size).toBe(0);
  });

  it("looks up several plans at once and never reads another tenant's", async () => {
    const world = await newWorld('batch');
    const intruder = await newWorld('snoop');
    const planId = await planOf(world);
    const otherPlan = await planOf(intruder);
    await createCase(world);
    await createCase(intruder);

    const found = await cases.findLiveByPlanIds(world.tenantId, [planId, otherPlan]);

    expect([...found.keys()]).toEqual([planId]);
    expect(await cases.findLiveByPlanIds(world.tenantId, [])).toEqual(new Map());
  });
});
