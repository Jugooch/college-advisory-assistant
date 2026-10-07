/**
 * @file Integration tests that a revision's pinned versions and times match the snapshots.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { violationOf } from '../testing/catalog-fixtures';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { buildNewRevision, insertPlanWorld } from '../testing/plan-fixtures';
import { createPlanRepository, type PlanRepository } from './plan.repository';

describe('plan revision pinned records', () => {
  let testDatabase: TestDatabase;
  let plans: PlanRepository;

  beforeAll(() => {
    testDatabase = openTestDatabase();
    plans = createPlanRepository(testDatabase.db);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  it('accepts pins that match the snapshots', async () => {
    const { db } = testDatabase;
    const world = await insertPlanWorld(db, await insertTenant(db), 'ok');

    const created = await plans.createWithFirstRevision(
      world.tenantId,
      { studentId: world.studentId, termId: world.termId, createdAt: '2026-10-01T15:00:00.000Z' },
      buildNewRevision(world),
    );

    expect(created.status).toBe('CREATED');
  });

  const refusedBy = async (overrides: Parameters<typeof buildNewRevision>[1], key: string) => {
    const { db } = testDatabase;
    const world = await insertPlanWorld(db, await insertTenant(db), 'pins');
    await expect(
      plans.createWithFirstRevision(
        world.tenantId,
        { studentId: world.studentId, termId: world.termId, createdAt: '2026-10-01T15:00:00.000Z' },
        buildNewRevision(world, overrides),
      ),
    ).rejects.toMatchObject(violationOf(key));
  };

  it('refuses a pinned audit version that is not the audit’s', async () => {
    await refusedBy({ auditVersion: 'audit_demo_r99' }, 'plan_revision_audit_snapshot_fk');
  });

  it('refuses a pinned audit source that is not the audit’s', async () => {
    await refusedBy({ auditSource: 'other-audit' }, 'plan_revision_audit_snapshot_fk');
  });

  it('refuses a pinned audit time later than the audit’s', async () => {
    await refusedBy(
      { auditRecordEffectiveAt: '2026-09-30T06:00:00.000Z' },
      'plan_revision_audit_snapshot_fk',
    );
  });

  it('refuses a pinned student record time that is not the snapshot’s', async () => {
    await refusedBy(
      { studentRecordEffectiveAt: '2026-09-30T06:00:00.000Z' },
      'plan_revision_student_snapshot_fk',
    );
  });
});
