/**
 * @file Proves the QA plan repository fake follows the `@caa/db` contract: one plan per student
 * and term, tenant-filtered reads, and `expectedRevision` conflicts on append.
 * @requirement FR-11
 * @see docs/standards/07-testing.md
 */
import { describe, expect, it } from 'vitest';

import type { NewPlanRevision } from '@caa/db';
import { PlanRevisionIdSchema } from '@caa/domain';
import { buildPlan, buildPlanRevision, SYNTHETIC_TENANTS, syntheticId } from '@caa/test-kit';

import { createPlanRepositories } from './plan-repositories';

const TENANT_A = SYNTHETIC_TENANTS.a.id;
const TENANT_B = SYNTHETIC_TENANTS.b.id;
const BUILT = buildPlan();
const NEW_PLAN = { studentId: BUILT.studentId, termId: BUILT.termId, createdAt: BUILT.createdAt };

/**
 * Builds a new-revision payload. The built revision's ID, plan, and number are ignored: the
 * repository assigns them.
 *
 * @returns The payload with an opaque result.
 */
function newRevision(): NewPlanRevision {
  return { ...buildPlanRevision(), result: { kind: 'opaque' } };
}

describe('plan repository fake', () => {
  it('creates a plan with revision 1 and refuses a second plan for the same term', async () => {
    const { plans } = createPlanRepositories({});
    const first = await plans.createWithFirstRevision(TENANT_A, NEW_PLAN, newRevision());
    expect(first.status).toBe('CREATED');
    const second = await plans.createWithFirstRevision(TENANT_A, NEW_PLAN, newRevision());
    expect(second).toEqual({ status: 'PLAN_EXISTS' });
  });

  it('appends only when expectedRevision is the latest, and reports a conflict otherwise', async () => {
    const { plans } = createPlanRepositories({});
    const created = await plans.createWithFirstRevision(TENANT_A, NEW_PLAN, newRevision());
    if (created.status !== 'CREATED') {
      throw new Error('expected CREATED');
    }
    const id = created.plan.id;
    const stale = await plans.appendRevision(TENANT_A, id, {
      expectedRevision: 0,
      revision: newRevision(),
    });
    expect(stale).toEqual({ status: 'REVISION_CONFLICT' });
    const appended = await plans.appendRevision(TENANT_A, id, {
      expectedRevision: 1,
      revision: newRevision(),
    });
    expect(appended.status === 'APPENDED' && appended.revision.revision.revision).toBe(2);
    expect((await plans.findRevision(TENANT_A, id, 'LATEST'))?.revision.revision).toBe(2);
    expect((await plans.findRevision(TENANT_A, id, 1))?.revision.revision).toBe(1);
  });

  it("hides another tenant's plan on every read and append", async () => {
    const { plans } = createPlanRepositories({});
    const created = await plans.createWithFirstRevision(TENANT_A, NEW_PLAN, newRevision());
    if (created.status !== 'CREATED') {
      throw new Error('expected CREATED');
    }
    const id = created.plan.id;
    expect(await plans.findPlan(TENANT_B, id)).toBeNull();
    expect(await plans.findRevision(TENANT_B, id, 'LATEST')).toBeNull();
    expect(await plans.listForStudent(TENANT_B, NEW_PLAN.studentId)).toEqual([]);
    expect(
      await plans.appendRevision(TENANT_B, id, { expectedRevision: 1, revision: newRevision() }),
    ).toEqual({ status: 'PLAN_NOT_FOUND' });
    expect(await plans.listForStudent(TENANT_A, NEW_PLAN.studentId)).toHaveLength(1);
  });

  it('finds a revision by ID within the tenant only', async () => {
    const { plans } = createPlanRepositories({});
    const created = await plans.createWithFirstRevision(TENANT_A, NEW_PLAN, newRevision());
    if (created.status !== 'CREATED') {
      throw new Error('expected CREATED');
    }
    const revisionId = created.revision.revision.id;
    expect((await plans.findRevisionById?.(TENANT_A, revisionId))?.revision.id).toBe(revisionId);
    expect(await plans.findRevisionById?.(TENANT_B, revisionId)).toBeNull();
    const absent = PlanRevisionIdSchema.parse(syntheticId('planRevision', 99));
    expect(await plans.findRevisionById?.(TENANT_A, absent)).toBeNull();
  });
});
