/**
 * @file Integration tests for the plan repository and its tables against PostgreSQL.
 */
import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AuditSnapshotIdSchema,
  PlanIdSchema,
  PlanRevisionCause,
  ScheduleOutcome,
} from '@caa/domain';

import { planRevisionTable } from '../tables/plan-revision.table';
import { violationOf } from '../testing/catalog-fixtures';
import {
  insertStudent,
  insertTenant,
  openTestDatabase,
  type TestDatabase,
} from '../testing/integration-fixtures';
import { buildNewRevision, insertPlanWorld, type PlanWorld } from '../testing/plan-fixtures';
import { insertAudit, insertSnapshot } from '../testing/snapshot-fixtures';
import { createPlanRepository, type PlanRepository } from './plan.repository';

describe('PlanRepository', () => {
  let testDatabase: TestDatabase;
  let plans: PlanRepository;

  beforeAll(() => {
    testDatabase = openTestDatabase();
    plans = createPlanRepository(testDatabase.db);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const newWorld = async (label: string): Promise<PlanWorld> =>
    insertPlanWorld(testDatabase.db, await insertTenant(testDatabase.db), label);

  const newPlan = (world: PlanWorld) => ({
    studentId: world.studentId,
    termId: world.termId,
    createdAt: '2026-10-01T15:00:00.000Z',
  });

  const createPlan = async (world: PlanWorld) => {
    const created = await plans.createWithFirstRevision(
      world.tenantId,
      newPlan(world),
      buildNewRevision(world),
    );
    if (created.status !== 'CREATED') {
      throw new Error('expected the plan to be created');
    }
    return created;
  };

  describe('createWithFirstRevision', () => {
    it('creates the plan and revision 1 with the opaque result intact', async () => {
      const world = await newWorld('create');

      const created = await createPlan(world);

      expect(created.plan).toMatchObject({ tenantId: world.tenantId, studentId: world.studentId });
      expect(created.revision.revision).toMatchObject({ revision: 1, planId: created.plan.id });
      expect(created.revision.result).toEqual(buildNewRevision(world).result);
    });

    it('returns PLAN_EXISTS for a second plan for the same student and term', async () => {
      const world = await newWorld('dup');
      await createPlan(world);

      const second = await plans.createWithFirstRevision(
        world.tenantId,
        newPlan(world),
        buildNewRevision(world),
      );

      expect(second).toEqual({ status: 'PLAN_EXISTS' });
    });

    it('creates neither row when the revision is refused', async () => {
      const world = await newWorld('atomic');
      const unpinned = buildNewRevision(world, {
        auditSnapshotId: AuditSnapshotIdSchema.parse(randomUUID()),
      });

      await expect(
        plans.createWithFirstRevision(world.tenantId, newPlan(world), unpinned),
      ).rejects.toMatchObject(violationOf('plan_revision_audit_snapshot_fk'));

      expect(await plans.listForStudent(world.tenantId, world.studentId)).toEqual([]);
      const retry = await plans.createWithFirstRevision(
        world.tenantId,
        newPlan(world),
        buildNewRevision(world),
      );
      expect(retry.status).toBe('CREATED');
    });

    it("refuses to pin another tenant's student", async () => {
      const mine = await newWorld('mine');
      const other = await newWorld('other');

      await expect(
        plans.createWithFirstRevision(mine.tenantId, newPlan(other), buildNewRevision(mine)),
      ).rejects.toMatchObject(violationOf('plan_student_fk'));
    });

    it("refuses to pin another student's audit", async () => {
      const { db } = testDatabase;
      const world = await newWorld('a');
      const otherStudentId = await insertStudent(db, world.tenantId, 'SYN-other');
      const otherSnapshotId = await insertSnapshot(db, world.tenantId, {
        studentId: otherStudentId,
        sourceEffectiveAt: '2026-09-10T06:00:00.000Z',
      });
      const otherAuditId = await insertAudit(db, world.tenantId, {
        studentId: otherStudentId,
        studentSnapshotId: otherSnapshotId,
        generatedAt: '2026-09-11T06:00:00.000Z',
        requirements: [{ sourceRequirementId: 'REQ-ROOT' }],
      });

      await expect(
        plans.createWithFirstRevision(
          world.tenantId,
          newPlan(world),
          buildNewRevision(world, { auditSnapshotId: otherAuditId }),
        ),
      ).rejects.toMatchObject(violationOf('plan_revision_audit_snapshot_fk'));
    });
  });

  describe('appendRevision', () => {
    it('appends expectedRevision + 1 and keeps the earlier revision', async () => {
      const world = await newWorld('append');
      const { plan } = await createPlan(world);

      const result = await plans.appendRevision(world.tenantId, plan.id, {
        expectedRevision: 1,
        revision: buildNewRevision(world, {
          cause: PlanRevisionCause.Revalidated,
          outcome: ScheduleOutcome.NoFeasiblePlan,
          selectedSectionIds: null,
          result: { outcome: 'NO_FEASIBLE_PLAN' },
        }),
      });

      expect(result.status).toBe('APPENDED');
      const first = await plans.findRevision(world.tenantId, plan.id, 1);
      const second = await plans.findRevision(world.tenantId, plan.id, 'LATEST');
      expect(first?.revision.cause).toBe('SAVED');
      expect(second?.revision).toMatchObject({ revision: 2, cause: 'REVALIDATED' });
      expect(second?.result).toEqual({ outcome: 'NO_FEASIBLE_PLAN' });
    });

    it('returns REVISION_CONFLICT for a stale expectedRevision and writes nothing', async () => {
      const world = await newWorld('stale');
      const { plan } = await createPlan(world);
      await plans.appendRevision(world.tenantId, plan.id, {
        expectedRevision: 1,
        revision: buildNewRevision(world),
      });

      const stale = await plans.appendRevision(world.tenantId, plan.id, {
        expectedRevision: 1,
        revision: buildNewRevision(world),
      });

      expect(stale).toEqual({ status: 'REVISION_CONFLICT' });
      expect((await plans.findRevision(world.tenantId, plan.id, 'LATEST'))?.revision.revision).toBe(
        2,
      );
    });

    it('returns REVISION_CONFLICT rather than leaving a gap for a future expectedRevision', async () => {
      const world = await newWorld('gap');
      const { plan } = await createPlan(world);

      const result = await plans.appendRevision(world.tenantId, plan.id, {
        expectedRevision: 5,
        revision: buildNewRevision(world),
      });

      expect(result).toEqual({ status: 'REVISION_CONFLICT' });
      expect(await plans.findRevision(world.tenantId, plan.id, 6)).toBeNull();
    });

    it('gives one winner and one conflict when two appends race', async () => {
      const world = await newWorld('race');
      const { plan } = await createPlan(world);

      const results = await Promise.all([
        plans.appendRevision(world.tenantId, plan.id, {
          expectedRevision: 1,
          revision: buildNewRevision(world),
        }),
        plans.appendRevision(world.tenantId, plan.id, {
          expectedRevision: 1,
          revision: buildNewRevision(world),
        }),
      ]);

      expect(results.map((result) => result.status).toSorted()).toEqual([
        'APPENDED',
        'REVISION_CONFLICT',
      ]);
    });

    it('is refused by the database for a duplicate revision number', async () => {
      const world = await newWorld('unique');
      const { plan } = await createPlan(world);
      const [row] = await testDatabase.db
        .select()
        .from(planRevisionTable)
        .where(eq(planRevisionTable.planId, plan.id));
      if (!row) {
        throw new Error('expected the first revision to exist');
      }

      const duplicate = testDatabase.db
        .insert(planRevisionTable)
        .values({ ...row, id: randomUUID() });

      await expect(duplicate).rejects.toMatchObject(violationOf('plan_revision_plan_revision_key'));
    });

    it("returns PLAN_NOT_FOUND for another tenant's plan", async () => {
      const world = await newWorld('owner');
      const intruder = await newWorld('intruder');
      const { plan } = await createPlan(world);

      const result = await plans.appendRevision(intruder.tenantId, plan.id, {
        expectedRevision: 1,
        revision: buildNewRevision(intruder),
      });

      expect(result).toEqual({ status: 'PLAN_NOT_FOUND' });
      expect(await plans.findRevision(world.tenantId, plan.id, 2)).toBeNull();
    });

    it('returns PLAN_NOT_FOUND for an unknown plan', async () => {
      const world = await newWorld('unknown');

      const result = await plans.appendRevision(world.tenantId, PlanIdSchema.parse(randomUUID()), {
        expectedRevision: 1,
        revision: buildNewRevision(world),
      });

      expect(result).toEqual({ status: 'PLAN_NOT_FOUND' });
    });
  });

  describe('reads', () => {
    it("returns nothing for another tenant's plan, revisions and student", async () => {
      const world = await newWorld('reader');
      const intruder = await newWorld('snoop');
      const { plan } = await createPlan(world);

      expect(await plans.findPlan(intruder.tenantId, plan.id)).toBeNull();
      expect(await plans.findRevision(intruder.tenantId, plan.id, 1)).toBeNull();
      expect(await plans.findRevision(intruder.tenantId, plan.id, 'LATEST')).toBeNull();
      expect(await plans.listForStudent(intruder.tenantId, world.studentId)).toEqual([]);
      expect(await plans.findPlan(world.tenantId, plan.id)).toEqual(plan);
    });

    it('lists the student plans with the newest revision of each', async () => {
      const world = await newWorld('list');
      const { plan } = await createPlan(world);
      await plans.appendRevision(world.tenantId, plan.id, {
        expectedRevision: 1,
        revision: buildNewRevision(world),
      });

      const listed = await plans.listForStudent(world.tenantId, world.studentId);

      expect(listed).toHaveLength(1);
      expect(listed[0]?.plan).toEqual(plan);
      expect(listed[0]?.latest.revision.revision).toBe(2);
    });

    it('returns null for a missing revision number', async () => {
      const world = await newWorld('missing');
      const { plan } = await createPlan(world);

      expect(await plans.findRevision(world.tenantId, plan.id, 9)).toBeNull();
    });
  });
});
