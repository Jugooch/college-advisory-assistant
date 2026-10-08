/**
 * @file Proves the QA case repository fake follows the `@caa/db` contract: one open or
 * in-review case per plan, `expectedSequence` conflicts, owner derived from the new status,
 * append-only events, tenant filtering, and the assignment-scoped queue.
 * @requirement FR-14
 * @see docs/standards/07-testing.md
 */
import { describe, expect, it } from 'vitest';

import type { NewAdvisingCase } from '@caa/db';
import {
  CaseAction,
  CaseReason,
  CaseResolution,
  CaseStatus,
  PlanIdSchema,
  PlanRevisionIdSchema,
  Role,
  StudentIdSchema,
  UserIdSchema,
} from '@caa/domain';
import {
  buildAdvisorAssignment,
  buildPlan,
  buildPlanRevision,
  buildStudent,
  SYNTHETIC_TENANTS,
  syntheticId,
} from '@caa/test-kit';

import { type CaseWorld, createCaseRepositories } from './case-repositories';

const TENANT_A = SYNTHETIC_TENANTS.a.id;
const TENANT_B = SYNTHETIC_TENANTS.b.id;
const STUDENT = StudentIdSchema.parse(syntheticId('student', 1));
const ABSENT_STUDENT = StudentIdSchema.parse(syntheticId('student', 9));
const ABSENT_REVISION = PlanRevisionIdSchema.parse(syntheticId('planRevision', 9));
const ADVISOR = UserIdSchema.parse(syntheticId('user', 2));
const OTHER_ADVISOR = UserIdSchema.parse(syntheticId('user', 4));
const AT = '2026-09-22T12:00:00.000-05:00';
const NEW_CASE: NewAdvisingCase = {
  studentId: STUDENT,
  reason: CaseReason.PlanReview,
  planRevisionId: PlanRevisionIdSchema.parse(syntheticId('planRevision', 1)),
  discrepancySubject: null,
  studentNote: 'Please check this plan.',
  actorUserId: UserIdSchema.parse(syntheticId('user', 1)),
  createdAt: '2026-09-22T10:00:00.000-05:00',
};

/**
 * Builds a world with one student, one plan with one revision, and one active assignment.
 *
 * @returns The world.
 */
function world(): CaseWorld {
  return {
    students: [buildStudent()],
    assignments: [buildAdvisorAssignment()],
    plans: [buildPlan()],
    planRevisions: [{ revision: buildPlanRevision(), result: { kind: 'opaque' } }],
  };
}

/**
 * The event that moves a case into review.
 *
 * @param actorUserId - The claiming advisor.
 * @returns The event fields.
 */
function claim(actorUserId: typeof ADVISOR) {
  return {
    action: CaseAction.Claim,
    actorUserId,
    at: AT,
    toStatus: CaseStatus.InReview,
    resolution: null,
    note: null,
  };
}

describe('case repository fake', () => {
  it('creates an OPEN unowned case with a CREATE event and refuses a second live case for the plan', async () => {
    const { cases } = createCaseRepositories(world());
    const first = await cases.create(TENANT_A, NEW_CASE);
    expect(first.status === 'CREATED' && [first.case.status, first.case.ownerUserId]).toEqual([
      CaseStatus.Open,
      null,
    ]);
    expect(await cases.create(TENANT_A, NEW_CASE)).toEqual({ status: 'OPEN_CASE_EXISTS' });
  });

  it('keeps actorRole from the create and append requests, and omits it when absent', async () => {
    const { cases } = createCaseRepositories(world());
    const plain = await cases.create(TENANT_A, NEW_CASE);
    expect(plain.status === 'CREATED' && plain.event.actorRole).toBeUndefined();
    expect(plain.status === 'CREATED' && 'actorRole' in plain.event).toBe(false);
    if (plain.status !== 'CREATED') {
      throw new Error('expected CREATED');
    }
    const staff = await cases.appendEvent(TENANT_A, plain.case.id, {
      expectedSequence: 1,
      event: { ...claim(ADVISOR), actorRole: Role.Admin },
    });
    expect(staff.status === 'APPENDED' && staff.event.actorRole).toBe('ADMIN');
    const bare = await cases.appendEvent(TENANT_A, plain.case.id, {
      expectedSequence: 2,
      event: { ...claim(ADVISOR), toStatus: CaseStatus.Open },
    });
    expect(bare.status === 'APPENDED' && 'actorRole' in bare.event).toBe(false);
  });

  it('records the student role on the CREATE event when the request has one', async () => {
    const { cases } = createCaseRepositories({ ...world() });
    const created = await cases.create(TENANT_A, { ...NEW_CASE, actorRole: Role.Student });
    expect(created.status === 'CREATED' && created.event.actorRole).toBe('STUDENT');
  });

  it('refuses an unknown student and a revision that is not the student plan', async () => {
    const { cases } = createCaseRepositories(world());
    const stranger = await cases.create(TENANT_A, {
      ...NEW_CASE,
      studentId: ABSENT_STUDENT,
    });
    expect(stranger).toEqual({ status: 'STUDENT_NOT_FOUND' });
    const missing = await cases.create(TENANT_A, {
      ...NEW_CASE,
      planRevisionId: ABSENT_REVISION,
    });
    expect(missing).toEqual({ status: 'PLAN_REVISION_NOT_FOUND' });
  });

  it('derives the owner from the new status and appends events in order', async () => {
    const { cases } = createCaseRepositories(world());
    const created = await cases.create(TENANT_A, NEW_CASE);
    if (created.status !== 'CREATED') {
      throw new Error('expected CREATED');
    }
    const id = created.case.id;
    const claimed = await cases.appendEvent(TENANT_A, id, {
      expectedSequence: 1,
      event: claim(ADVISOR),
    });
    expect(claimed.status === 'APPENDED' && claimed.case.ownerUserId).toBe(ADVISOR);
    const resolved = await cases.appendEvent(TENANT_A, id, {
      expectedSequence: 2,
      event: {
        action: CaseAction.Resolve,
        actorUserId: ADVISOR,
        at: AT,
        toStatus: CaseStatus.Resolved,
        resolution: CaseResolution.PlanReviewed,
        note: 'Reviewed.',
      },
    });
    expect(resolved.status === 'APPENDED' && resolved.case.lastSequence).toBe(3);
    const events = await cases.listEvents(TENANT_A, id);
    expect(events.map((event) => [event.sequence, event.fromStatus, event.toStatus])).toEqual([
      [1, null, CaseStatus.Open],
      [2, CaseStatus.Open, CaseStatus.InReview],
      [3, CaseStatus.InReview, CaseStatus.Resolved],
    ]);
  });

  it('reports a stale expectedSequence as a conflict and leaves the case unchanged', async () => {
    const { cases } = createCaseRepositories(world());
    const created = await cases.create(TENANT_A, NEW_CASE);
    if (created.status !== 'CREATED') {
      throw new Error('expected CREATED');
    }
    const id = created.case.id;
    await cases.appendEvent(TENANT_A, id, { expectedSequence: 1, event: claim(ADVISOR) });
    const stale = await cases.appendEvent(TENANT_A, id, {
      expectedSequence: 1,
      event: claim(OTHER_ADVISOR),
    });
    expect(stale).toEqual({ status: 'SEQUENCE_CONFLICT' });
    expect((await cases.findById(TENANT_A, id))?.ownerUserId).toBe(ADVISOR);
    expect(await cases.listEvents(TENANT_A, id)).toHaveLength(2);
  });

  it("hides another tenant's case on every read and append", async () => {
    const { cases } = createCaseRepositories(world());
    const created = await cases.create(TENANT_A, NEW_CASE);
    if (created.status !== 'CREATED') {
      throw new Error('expected CREATED');
    }
    const id = created.case.id;
    expect(await cases.findById(TENANT_B, id)).toBeNull();
    expect(await cases.listEvents(TENANT_B, id)).toEqual([]);
    expect(await cases.listForStudent(TENANT_B, STUDENT)).toEqual([]);
    expect(
      await cases.appendEvent(TENANT_B, id, { expectedSequence: 1, event: claim(ADVISOR) }),
    ).toEqual({ status: 'CASE_NOT_FOUND' });
  });

  it('queues a case only for an advisor actively assigned, and lists OPEN unassigned cases as unrouted', async () => {
    const { cases } = createCaseRepositories(world());
    await cases.create(TENANT_A, NEW_CASE);
    expect(await cases.listQueue(TENANT_A, ADVISOR, { at: AT })).toHaveLength(1);
    expect(
      await cases.listQueue(TENANT_A, ADVISOR, { at: AT, status: CaseStatus.Resolved }),
    ).toEqual([]);
    expect(await cases.listQueue(TENANT_A, OTHER_ADVISOR, { at: AT })).toEqual([]);
    expect(await cases.listUnrouted(TENANT_A, AT)).toEqual([]);

    const unassigned = createCaseRepositories({ ...world(), assignments: [] });
    await unassigned.cases.create(TENANT_A, NEW_CASE);
    expect(await unassigned.cases.listUnrouted(TENANT_A, AT)).toHaveLength(1);
  });

  it('finds the live case of each plan, ignoring resolved cases, other tenants, and unknown plans', async () => {
    const { cases } = createCaseRepositories(world());
    const created = await cases.create(TENANT_A, NEW_CASE);
    if (created.status !== 'CREATED') {
      throw new Error('expected CREATED');
    }
    const planId = buildPlan().id;
    const other = PlanIdSchema.parse(syntheticId('plan', 9));
    const found = await cases.findLiveByPlanIds(TENANT_A, [planId, other]);
    expect([...found].map(([key, value]) => [key, value.id])).toEqual([[planId, created.case.id]]);
    expect(await cases.findLiveByPlanIds(TENANT_B, [planId])).toEqual(new Map());
    expect(await cases.findLiveByPlanIds(TENANT_A, [])).toEqual(new Map());
  });

  it('stops finding a case by plan once it is resolved', async () => {
    const { cases } = createCaseRepositories(world());
    const created = await cases.create(TENANT_A, NEW_CASE);
    if (created.status !== 'CREATED') {
      throw new Error('expected CREATED');
    }
    const planId = buildPlan().id;
    await cases.appendEvent(TENANT_A, created.case.id, {
      expectedSequence: 1,
      event: {
        action: CaseAction.Resolve,
        actorUserId: ADVISOR,
        at: AT,
        toStatus: CaseStatus.Resolved,
        resolution: CaseResolution.PlanReviewed,
        note: 'Done.',
      },
    });
    expect(await cases.findLiveByPlanIds(TENANT_A, [planId])).toEqual(new Map());
  });

  it('lists every tenant case oldest first, flagged routed, filtered by status', async () => {
    const routed = createCaseRepositories(world());
    await routed.cases.create(TENANT_A, NEW_CASE);
    expect(await routed.cases.listTenantQueue(TENANT_A, { at: AT })).toEqual([
      expect.objectContaining({ studentId: STUDENT, routed: true }),
    ]);
    expect(await routed.cases.listTenantQueue(TENANT_B, { at: AT })).toEqual([]);
    expect(
      await routed.cases.listTenantQueue(TENANT_A, { at: AT, status: CaseStatus.Resolved }),
    ).toEqual([]);

    const unrouted = createCaseRepositories({ ...world(), assignments: [] });
    await unrouted.cases.create(TENANT_A, NEW_CASE);
    expect((await unrouted.cases.listTenantQueue(TENANT_A, { at: AT }))[0]?.routed).toBe(false);
    expect(() => unrouted.cases.listTenantQueue(TENANT_A, { at: 'not a date' })).toThrow(
      RangeError,
    );
  });

  it('refuses an invalid instant', () => {
    const { cases } = createCaseRepositories(world());
    expect(() => cases.listUnrouted(TENANT_A, 'not a date')).toThrow(RangeError);
  });
});
