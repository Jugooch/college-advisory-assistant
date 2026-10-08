/**
 * @file Integration tests for the tenant-wide case queue against PostgreSQL.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CaseStatus, type InstitutionId, type UserId } from '@caa/domain';

import { studentTable } from '../tables/student.table';
import {
  buildClaim,
  buildNewCase,
  type CaseWorld,
  insertAssignment,
  insertCaseWorldIn,
} from '../testing/case-fixtures';
import {
  insertTenant,
  insertUser,
  openTestDatabase,
  type TestDatabase,
} from '../testing/integration-fixtures';
import { insertSharedSections, type SharedSections } from '../testing/plan-fixtures';
import { createAdvisingCaseRepository } from './advising-case.repository';

const FROM = '2026-08-15T00:00:00.000Z';
const ENDS = '2026-11-01T00:00:00.000Z';
const BEFORE_END = '2026-10-31T23:59:59.999Z';

describe('AdvisingCaseRepository tenant queue', () => {
  let testDatabase: TestDatabase;
  let cases: ReturnType<typeof createAdvisingCaseRepository>;
  let tenantId: InstitutionId;
  let shared: SharedSections;
  let advisor: UserId;
  let otherAdvisor: UserId;
  let approver: UserId;

  const open = async (world: CaseWorld, createdAt?: string) => {
    const created = await cases.create(
      world.tenantId,
      buildNewCase(world, createdAt === undefined ? {} : { createdAt }),
    );
    if (created.status !== 'CREATED') {
      throw new Error('expected the case to be created');
    }
    return created.case;
  };

  beforeAll(async () => {
    testDatabase = openTestDatabase();
    cases = createAdvisingCaseRepository(testDatabase.db);
    tenantId = await insertTenant(testDatabase.db);
    shared = await insertSharedSections(testDatabase.db, tenantId);
    advisor = await insertUser(testDatabase.db, tenantId, 'advisor');
    otherAdvisor = await insertUser(testDatabase.db, tenantId, 'other-advisor');
    approver = await insertUser(testDatabase.db, tenantId, 'approver');
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  it('lists cases held by different advisors and unrouted ones, with the routed flag', async () => {
    const db = testDatabase.db;
    const mine = await open(await insertCaseWorldIn(db, shared, 'tq-mine'));
    const heldWorld = await insertCaseWorldIn(db, shared, 'tq-held');
    const held = await open(heldWorld);
    const lone = await open(await insertCaseWorldIn(db, shared, 'tq-lone'));
    const lapsed = await open(await insertCaseWorldIn(db, shared, 'tq-lapsed'));
    const base = { tenantId, approvedBy: approver, effectiveFrom: FROM, effectiveTo: null };
    await insertAssignment(db, { ...base, advisorUserId: advisor, studentId: mine.studentId });
    await insertAssignment(db, {
      ...base,
      advisorUserId: otherAdvisor,
      studentId: held.studentId,
    });
    await insertAssignment(db, {
      ...base,
      advisorUserId: advisor,
      studentId: lapsed.studentId,
      effectiveTo: ENDS,
    });

    const queue = await cases.listTenantQueue(tenantId, { at: ENDS });
    const routedById = new Map(queue.map((entry) => [entry.id, entry.routed]));

    expect(routedById.get(mine.id)).toBe(true);
    expect(routedById.get(held.id)).toBe(true);
    expect(routedById.get(lone.id)).toBe(false);
    expect(routedById.get(lapsed.id)).toBe(false);
    expect(queue.find((entry) => entry.id === mine.id)?.studentId).toBe(mine.studentId);
  });

  it('lists oldest first, each case once', async () => {
    const tenant = await insertTenant(testDatabase.db);
    const sections = await insertSharedSections(testDatabase.db, tenant);
    const newer = await insertCaseWorldIn(testDatabase.db, sections, 'order-newer');
    const older = await insertCaseWorldIn(testDatabase.db, sections, 'order-older');
    const newerCase = await open(newer, '2026-09-23T10:00:00.000Z');
    const olderCase = await open(older, '2026-09-21T10:00:00.000Z');

    const queue = await cases.listTenantQueue(tenant, { at: BEFORE_END });

    expect(queue.map((entry) => entry.id)).toEqual([olderCase.id, newerCase.id]);
  });

  it('hides the cases of students the source deleted', async () => {
    const world = await insertCaseWorldIn(testDatabase.db, shared, 'tq-deleted');
    const created = await open(world);
    await testDatabase.db
      .update(studentTable)
      .set({ isDeleted: true })
      .where(eq(studentTable.id, world.studentId));

    const queue = await cases.listTenantQueue(tenantId, { at: BEFORE_END });

    expect(queue.map((entry) => entry.id)).not.toContain(created.id);
  });

  it('filters by status', async () => {
    const world = await insertCaseWorldIn(testDatabase.db, shared, 'tq-status');
    const created = await open(world);
    await cases.appendEvent(tenantId, created.id, {
      expectedSequence: 1,
      event: buildClaim(otherAdvisor),
    });

    const inReview = await cases.listTenantQueue(tenantId, {
      at: BEFORE_END,
      status: CaseStatus.InReview,
    });
    const opened = await cases.listTenantQueue(tenantId, {
      at: BEFORE_END,
      status: CaseStatus.Open,
    });

    expect(inReview.map((entry) => entry.id)).toContain(created.id);
    expect(inReview.every((entry) => entry.status === CaseStatus.InReview)).toBe(true);
    expect(opened.map((entry) => entry.id)).not.toContain(created.id);
  });

  it("never returns another tenant's cases", async () => {
    const outsider = await insertTenant(testDatabase.db);
    const world = await insertCaseWorldIn(
      testDatabase.db,
      await insertSharedSections(testDatabase.db, outsider),
      'tq-outsider',
    );
    const foreign = await open(world);

    const ours = await cases.listTenantQueue(tenantId, { at: BEFORE_END });
    const theirsList = await cases.listTenantQueue(outsider, { at: BEFORE_END });

    expect(ours.map((entry) => entry.id)).not.toContain(foreign.id);
    expect(theirsList.map((entry) => entry.id)).toEqual([foreign.id]);
  });

  it('rejects an invalid instant', async () => {
    await expect(cases.listTenantQueue(tenantId, { at: 'not-a-date' })).rejects.toThrow(RangeError);
  });
});
