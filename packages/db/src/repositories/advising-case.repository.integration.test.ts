/**
 * @file Integration tests for the advising case repository and its tables against PostgreSQL.
 */
import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CaseAction, type CaseId, CaseIdSchema, CaseStatus } from '@caa/domain';

import { studentTable } from '../tables/student.table';
import {
  buildClaim,
  buildNewCase,
  buildResolve,
  type CaseWorld,
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

describe('AdvisingCaseRepository', () => {
  let testDatabase: TestDatabase;
  let cases: AdvisingCaseRepository;

  beforeAll(() => {
    testDatabase = openTestDatabase();
    cases = createAdvisingCaseRepository(testDatabase.db);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const newWorld = async (label: string): Promise<CaseWorld> =>
    insertCaseWorld(testDatabase.db, await insertTenant(testDatabase.db), label);

  const createCase = async (world: CaseWorld) => {
    const created = await cases.create(world.tenantId, buildNewCase(world));
    if (created.status !== 'CREATED') {
      throw new Error('expected the case to be created');
    }
    return created;
  };

  describe('appendEvent', () => {
    it('claims the case: IN_REVIEW, owned by the claimant, sequence 2', async () => {
      const world = await newWorld('claim');
      const { case: opened } = await createCase(world);

      const claimed = await cases.appendEvent(world.tenantId, opened.id, {
        expectedSequence: 1,
        event: buildClaim(world.userId),
      });

      expect(claimed).toMatchObject({
        status: 'APPENDED',
        case: { status: CaseStatus.InReview, ownerUserId: world.userId, lastSequence: 2 },
        event: { sequence: 2, fromStatus: CaseStatus.Open },
      });
    });

    it('lets exactly one of two concurrent claims win', async () => {
      const world = await newWorld('race');
      const { case: opened } = await createCase(world);
      const rival = await insertUser(testDatabase.db, world.tenantId, 'rival');

      const results = await Promise.all([
        cases.appendEvent(world.tenantId, opened.id, {
          expectedSequence: 1,
          event: buildClaim(world.userId),
        }),
        cases.appendEvent(world.tenantId, opened.id, {
          expectedSequence: 1,
          event: buildClaim(rival),
        }),
      ]);

      expect(results.map((result) => result.status).sort()).toEqual([
        'APPENDED',
        'SEQUENCE_CONFLICT',
      ]);
      expect(await cases.listEvents(world.tenantId, opened.id)).toHaveLength(2);
    });

    it('conflicts on a stale expected sequence and changes nothing', async () => {
      const world = await newWorld('stale');
      const { case: opened } = await createCase(world);
      await cases.appendEvent(world.tenantId, opened.id, {
        expectedSequence: 1,
        event: buildClaim(world.userId),
      });

      const stale = await cases.appendEvent(world.tenantId, opened.id, {
        expectedSequence: 1,
        event: buildClaim(world.userId),
      });

      expect(stale).toEqual({ status: 'SEQUENCE_CONFLICT' });
      expect((await cases.findById(world.tenantId, opened.id))?.lastSequence).toBe(2);
    });

    it('stores the resolution and note, and the resolver owns the case', async () => {
      const world = await newWorld('resolve');
      const { case: opened } = await createCase(world);
      await cases.appendEvent(world.tenantId, opened.id, {
        expectedSequence: 1,
        event: buildClaim(world.userId),
      });

      const resolved = await cases.appendEvent(world.tenantId, opened.id, {
        expectedSequence: 2,
        event: buildResolve(world.userId),
      });

      expect(resolved).toMatchObject({
        case: { status: CaseStatus.Resolved, ownerUserId: world.userId },
        event: { resolution: 'PLAN_REVIEWED', note: 'Reviewed the plan with the student.' },
      });
    });

    it('clears the owner on withdrawal', async () => {
      const world = await newWorld('withdraw');
      const { case: opened } = await createCase(world);
      const withdraw = {
        ...buildClaim(world.userId),
        action: CaseAction.Withdraw,
        toStatus: CaseStatus.Withdrawn,
      };

      const withdrawn = await cases.appendEvent(world.tenantId, opened.id, {
        expectedSequence: 1,
        event: withdraw,
      });

      expect(withdrawn).toMatchObject({
        case: { status: CaseStatus.Withdrawn, ownerUserId: null },
      });
    });

    it('returns CASE_NOT_FOUND for another tenant and for an unknown case', async () => {
      const world = await newWorld('own');
      const outsider = await insertTenant(testDatabase.db);
      const { case: opened } = await createCase(world);
      const unknown: CaseId = CaseIdSchema.parse(randomUUID());

      const crossTenant = await cases.appendEvent(outsider, opened.id, {
        expectedSequence: 1,
        event: buildClaim(world.userId),
      });
      const missing = await cases.appendEvent(world.tenantId, unknown, {
        expectedSequence: 1,
        event: buildClaim(world.userId),
      });

      expect(crossTenant).toEqual({ status: 'CASE_NOT_FOUND' });
      expect(missing).toEqual({ status: 'CASE_NOT_FOUND' });
    });
  });

  describe('reads', () => {
    it('finds a case and lists its events oldest first', async () => {
      const world = await newWorld('read');
      const { case: opened } = await createCase(world);
      await cases.appendEvent(world.tenantId, opened.id, {
        expectedSequence: 1,
        event: buildClaim(world.userId),
      });

      const events = await cases.listEvents(world.tenantId, opened.id);

      expect((await cases.findById(world.tenantId, opened.id))?.id).toBe(opened.id);
      expect(events.map((event) => event.sequence)).toEqual([1, 2]);
    });

    it("lists a student's cases newest first", async () => {
      const world = await newWorld('list');
      const first = await createCase(world);
      await cases.appendEvent(world.tenantId, first.case.id, {
        expectedSequence: 1,
        event: buildClaim(world.userId),
      });
      await cases.appendEvent(world.tenantId, first.case.id, {
        expectedSequence: 2,
        event: buildResolve(world.userId),
      });
      const later = await cases.create(
        world.tenantId,
        buildNewCase(world, { createdAt: '2026-10-05T10:00:00.000Z' }),
      );

      const listed = await cases.listForStudent(world.tenantId, world.studentId);

      expect(listed.map((entry) => entry.id)).toEqual([
        later.status === 'CREATED' ? later.case.id : null,
        first.case.id,
      ]);
    });

    it('hides cases, events and lists from another tenant', async () => {
      const world = await newWorld('iso');
      const outsider = await insertTenant(testDatabase.db);
      const { case: opened } = await createCase(world);

      expect(await cases.findById(outsider, opened.id)).toBeNull();
      expect(await cases.listEvents(outsider, opened.id)).toEqual([]);
      expect(await cases.listForStudent(outsider, world.studentId)).toEqual([]);
    });

    it('hides the cases of a student deleted by the source', async () => {
      const world = await newWorld('hidden');
      const { case: opened } = await createCase(world);
      await testDatabase.db
        .update(studentTable)
        .set({ isDeleted: true })
        .where(eq(studentTable.id, world.studentId));

      expect(await cases.findById(world.tenantId, opened.id)).toBeNull();
      expect(await cases.listForStudent(world.tenantId, world.studentId)).toEqual([]);
    });
  });
});
