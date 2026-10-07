/**
 * @file Integration tests that the database itself keeps plan revisions immutable.
 */
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { planRevisionTable } from '../tables/plan-revision.table';
import { immutableRowRejectionOf } from '../testing/catalog-fixtures';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { buildNewRevision, insertPlanWorld } from '../testing/plan-fixtures';
import { createPlanRepository, type PlanRepository } from './plan.repository';

describe('plan_revision immutability', () => {
  let testDatabase: TestDatabase;
  let plans: PlanRepository;

  beforeAll(() => {
    testDatabase = openTestDatabase();
    plans = createPlanRepository(testDatabase.db);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const createPlan = async (label: string) => {
    const { db } = testDatabase;
    const world = await insertPlanWorld(db, await insertTenant(db), label);
    const created = await plans.createWithFirstRevision(
      world.tenantId,
      { studentId: world.studentId, termId: world.termId, createdAt: '2026-10-01T15:00:00.000Z' },
      buildNewRevision(world),
    );
    if (created.status !== 'CREATED') {
      throw new Error('expected the plan to be created');
    }
    return { world, plan: created.plan };
  };

  const hasTrigger = async (name: string): Promise<boolean> => {
    const result = await testDatabase.db.execute(
      sql`SELECT 1 FROM pg_trigger WHERE tgname = ${name} AND tgrelid = 'plan_revision'::regclass`,
    );
    return result.rows.length === 1;
  };

  it('has the row and truncate triggers installed', async () => {
    expect(await hasTrigger('plan_revision_immutable_row')).toBe(true);
    expect(await hasTrigger('plan_revision_immutable_truncate')).toBe(true);
  });

  it('refuses to update a stored revision', async () => {
    const { world, plan } = await createPlan('update');

    const update = testDatabase.db
      .update(planRevisionTable)
      .set({ result: { tampered: true } })
      .where(eq(planRevisionTable.planId, plan.id));

    await expect(update).rejects.toMatchObject(immutableRowRejectionOf('plan_revision'));
    const stored = await plans.findRevision(world.tenantId, plan.id, 1);
    expect(stored?.result).toEqual(buildNewRevision(world).result);
  });

  it('refuses to delete a stored revision', async () => {
    const { plan } = await createPlan('delete');

    const remove = testDatabase.db
      .delete(planRevisionTable)
      .where(eq(planRevisionTable.planId, plan.id));

    await expect(remove).rejects.toMatchObject(immutableRowRejectionOf('plan_revision'));
  });

  it('refuses to truncate the table', async () => {
    // NOTE: rolled back either way, so a missing trigger fails this test without emptying
    // the table for other tests. advising_case and case_event reference it, so they are listed too;
    // plan_revision comes first, so its trigger is the one that fires.
    const truncate = testDatabase.db.transaction(async (tx) => {
      await tx.execute(sql`TRUNCATE "plan_revision", "advising_case", "case_event"`);
      throw new Error('rollback');
    });

    await expect(truncate).rejects.toMatchObject(immutableRowRejectionOf('plan_revision'));
  });
});
