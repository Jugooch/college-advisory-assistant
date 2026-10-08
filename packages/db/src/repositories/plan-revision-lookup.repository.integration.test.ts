/**
 * @file Integration tests for finding a plan revision by its ID against PostgreSQL.
 */
import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PlanRevisionIdSchema } from '@caa/domain';

import { studentTable } from '../tables/student.table';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { buildNewRevision, insertPlanWorld, type PlanWorld } from '../testing/plan-fixtures';
import { createPlanRepository } from './plan.repository';

describe('PlanRepository.findRevisionById', () => {
  let testDatabase: TestDatabase;
  let plans: ReturnType<typeof createPlanRepository>;

  beforeAll(() => {
    testDatabase = openTestDatabase();
    plans = createPlanRepository(testDatabase.db);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const newWorld = async (label: string): Promise<PlanWorld> =>
    insertPlanWorld(testDatabase.db, await insertTenant(testDatabase.db), label);

  it('finds the stored revision by ID', async () => {
    const world = await newWorld('by-id');
    const created = await plans.createWithFirstRevision(
      world.tenantId,
      { studentId: world.studentId, termId: world.termId, createdAt: '2026-10-01T15:00:00.000Z' },
      buildNewRevision(world),
    );
    if (created.status !== 'CREATED') {
      throw new Error('expected the plan to be created');
    }

    const found = await plans.findRevisionById(world.tenantId, created.revision.revision.id);

    expect(found).toEqual(created.revision);
  });

  it('returns null for another tenant and for an unknown ID', async () => {
    const world = await newWorld('owner');
    const intruder = await newWorld('snoop');
    const created = await plans.createWithFirstRevision(
      world.tenantId,
      { studentId: world.studentId, termId: world.termId, createdAt: '2026-10-01T15:00:00.000Z' },
      buildNewRevision(world),
    );
    if (created.status !== 'CREATED') {
      throw new Error('expected the plan to be created');
    }

    expect(
      await plans.findRevisionById(intruder.tenantId, created.revision.revision.id),
    ).toBeNull();
    expect(
      await plans.findRevisionById(world.tenantId, PlanRevisionIdSchema.parse(randomUUID())),
    ).toBeNull();
  });

  it('returns null once the source has deleted the student', async () => {
    const world = await newWorld('tombstone');
    const created = await plans.createWithFirstRevision(
      world.tenantId,
      { studentId: world.studentId, termId: world.termId, createdAt: '2026-10-01T15:00:00.000Z' },
      buildNewRevision(world),
    );
    if (created.status !== 'CREATED') {
      throw new Error('expected the plan to be created');
    }
    await testDatabase.db
      .update(studentTable)
      .set({ isDeleted: true })
      .where(eq(studentTable.id, world.studentId));

    expect(await plans.findRevisionById(world.tenantId, created.revision.revision.id)).toBeNull();
  });
});
