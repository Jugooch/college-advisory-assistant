/**
 * @file Integration tests for the advisor queue and the unrouted list against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CaseStatus, type InstitutionId, type UserId } from '@caa/domain';

import {
  buildClaim,
  buildNewCase,
  type CaseWorld,
  insertAssignment,
  insertCaseWorld,
} from '../testing/case-fixtures';
import {
  insertTenant,
  insertUser,
  openTestDatabase,
  type TestDatabase,
} from '../testing/integration-fixtures';
import {
  type AdvisingCaseRepository,
  createAdvisingCaseRepository,
} from './advising-case.repository';

const FROM = '2026-08-15T00:00:00.000Z';
const ENDS = '2026-11-01T00:00:00.000Z';
const BEFORE_END = '2026-10-31T23:59:59.999Z';

describe('AdvisingCaseRepository queue', () => {
  let testDatabase: TestDatabase;
  let cases: AdvisingCaseRepository;
  let tenantId: InstitutionId;
  let advisor: UserId;
  let otherAdvisor: UserId;
  let approver: UserId;
  let assigned: CaseWorld;
  let ended: CaseWorld;
  let unassigned: CaseWorld;
  let theirs: CaseWorld;

  const open = async (world: CaseWorld) => {
    const created = await cases.create(world.tenantId, buildNewCase(world));
    if (created.status !== 'CREATED') {
      throw new Error('expected the case to be created');
    }
    return created.case;
  };

  beforeAll(async () => {
    testDatabase = openTestDatabase();
    const { db } = testDatabase;
    cases = createAdvisingCaseRepository(db);
    tenantId = await insertTenant(db);
    advisor = await insertUser(db, tenantId, 'advisor');
    otherAdvisor = await insertUser(db, tenantId, 'other-advisor');
    approver = await insertUser(db, tenantId, 'approver');
    assigned = await insertCaseWorld(db, tenantId, 'assigned');
    ended = await insertCaseWorld(db, tenantId, 'ended');
    unassigned = await insertCaseWorld(db, tenantId, 'unassigned');
    theirs = await insertCaseWorld(db, tenantId, 'theirs');
    const base = { tenantId, approvedBy: approver, effectiveFrom: FROM };
    await insertAssignment(db, {
      ...base,
      advisorUserId: advisor,
      studentId: assigned.studentId,
      effectiveTo: null,
    });
    await insertAssignment(db, {
      ...base,
      advisorUserId: advisor,
      studentId: ended.studentId,
      effectiveTo: ENDS,
    });
    await insertAssignment(db, {
      ...base,
      advisorUserId: otherAdvisor,
      studentId: theirs.studentId,
      effectiveTo: null,
    });
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  it("returns only the cases of the advisor's actively assigned students", async () => {
    const mine = await open(assigned);
    await open(unassigned);
    await open(theirs);

    const queue = await cases.listQueue(tenantId, advisor, { at: BEFORE_END });

    expect(queue.map((entry) => entry.studentId)).toContain(assigned.studentId);
    expect(queue.map((entry) => entry.id)).toContain(mine.id);
    expect(queue.map((entry) => entry.studentId)).not.toContain(unassigned.studentId);
    expect(queue.map((entry) => entry.studentId)).not.toContain(theirs.studentId);
  });

  it('drops a case when the assignment ended at or before the query time (AC15)', async () => {
    const endedCase = await open(ended);

    const before = await cases.listQueue(tenantId, advisor, { at: BEFORE_END });
    const atEnd = await cases.listQueue(tenantId, advisor, { at: ENDS });

    expect(before.map((entry) => entry.id)).toContain(endedCase.id);
    expect(atEnd.map((entry) => entry.id)).not.toContain(endedCase.id);
  });

  it('shows nothing before an assignment starts', async () => {
    const queue = await cases.listQueue(tenantId, advisor, { at: '2026-08-14T23:59:59.999Z' });

    expect(queue).toEqual([]);
  });

  it('filters by status', async () => {
    const claimable = await insertCaseWorld(testDatabase.db, tenantId, 'status');
    await insertAssignment(testDatabase.db, {
      tenantId,
      advisorUserId: advisor,
      studentId: claimable.studentId,
      approvedBy: approver,
      effectiveFrom: FROM,
      effectiveTo: null,
    });
    const created = await open(claimable);
    await cases.appendEvent(tenantId, created.id, {
      expectedSequence: 1,
      event: buildClaim(advisor),
    });

    const inReview = await cases.listQueue(tenantId, advisor, {
      at: BEFORE_END,
      status: CaseStatus.InReview,
    });
    const opened = await cases.listQueue(tenantId, advisor, {
      at: BEFORE_END,
      status: CaseStatus.Open,
    });

    expect(inReview.map((entry) => entry.id)).toEqual([created.id]);
    expect(opened.map((entry) => entry.id)).not.toContain(created.id);
  });

  it('lists a case once even when the student has overlapping assignments', async () => {
    const twice = await insertCaseWorld(testDatabase.db, tenantId, 'twice');
    const base = {
      tenantId,
      advisorUserId: advisor,
      studentId: twice.studentId,
      approvedBy: approver,
    };
    await insertAssignment(testDatabase.db, { ...base, effectiveFrom: FROM, effectiveTo: null });
    await insertAssignment(testDatabase.db, {
      ...base,
      effectiveFrom: '2026-09-01T00:00:00.000Z',
      effectiveTo: null,
    });
    const created = await open(twice);

    const queue = await cases.listQueue(tenantId, advisor, { at: BEFORE_END });

    expect(queue.filter((entry) => entry.id === created.id)).toHaveLength(1);
  });

  it("never returns another tenant's cases", async () => {
    const outsider = await insertTenant(testDatabase.db);

    expect(await cases.listQueue(outsider, advisor, { at: BEFORE_END })).toEqual([]);
    expect(await cases.listUnrouted(outsider, BEFORE_END)).toEqual([]);
  });

  it('lists open cases of students with no active assignment as unrouted', async () => {
    const lone = await open(await insertCaseWorld(testDatabase.db, tenantId, 'unrouted'));
    const routed = await open(await insertCaseWorld(testDatabase.db, tenantId, 'routed'));
    await insertAssignment(testDatabase.db, {
      tenantId,
      advisorUserId: advisor,
      studentId: routed.studentId,
      approvedBy: approver,
      effectiveFrom: FROM,
      effectiveTo: null,
    });

    const unrouted = (await cases.listUnrouted(tenantId, BEFORE_END)).map((entry) => entry.id);

    expect(unrouted).toContain(lone.id);
    expect(unrouted).not.toContain(routed.id);
  });

  it('moves a case to unrouted once its only assignment has ended', async () => {
    const lapsing = await insertCaseWorld(testDatabase.db, tenantId, 'lapsing');
    await insertAssignment(testDatabase.db, {
      tenantId,
      advisorUserId: advisor,
      studentId: lapsing.studentId,
      approvedBy: approver,
      effectiveFrom: FROM,
      effectiveTo: ENDS,
    });
    const created = await open(lapsing);

    const before = await cases.listUnrouted(tenantId, BEFORE_END);
    const after = await cases.listUnrouted(tenantId, ENDS);

    expect(before.map((entry) => entry.id)).not.toContain(created.id);
    expect(after.map((entry) => entry.id)).toContain(created.id);
  });

  it('leaves a claimed case out of the unrouted list', async () => {
    const world = await insertCaseWorld(testDatabase.db, tenantId, 'claimed');
    const created = await open(world);
    await cases.appendEvent(tenantId, created.id, {
      expectedSequence: 1,
      event: buildClaim(otherAdvisor),
    });

    const unrouted = await cases.listUnrouted(tenantId, BEFORE_END);

    expect(unrouted.map((entry) => entry.id)).not.toContain(created.id);
  });

  it('rejects an invalid instant', async () => {
    await expect(cases.listQueue(tenantId, advisor, { at: 'not-a-date' })).rejects.toThrow(
      RangeError,
    );
    await expect(cases.listUnrouted(tenantId, 'not-a-date')).rejects.toThrow(RangeError);
  });
});
