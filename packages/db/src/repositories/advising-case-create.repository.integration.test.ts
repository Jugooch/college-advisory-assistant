/**
 * @file Integration tests for creating advising cases against PostgreSQL.
 */
import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CaseReason, CaseStatus, DiscrepancySubject, PlanRevisionIdSchema } from '@caa/domain';

import { studentTable } from '../tables/student.table';
import {
  buildClaim,
  buildNewCase,
  buildResolve,
  type CaseWorld,
  insertCaseWorld,
} from '../testing/case-fixtures';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import {
  type AdvisingCaseRepository,
  createAdvisingCaseRepository,
} from './advising-case.repository';

describe('AdvisingCaseRepository create', () => {
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

  describe('create', () => {
    it('creates an OPEN unowned case with its CREATE event as sequence 1', async () => {
      const world = await newWorld('create');

      const created = await createCase(world);

      expect(created.case).toMatchObject({
        status: CaseStatus.Open,
        ownerUserId: null,
        lastSequence: 1,
        planRevisionId: world.planRevisionId,
      });
      expect(created.event).toMatchObject({
        caseId: created.case.id,
        sequence: 1,
        action: 'CREATE',
      });
    });

    it('refuses a second open case for the same plan', async () => {
      const world = await newWorld('second-open');
      await createCase(world);

      const second = await cases.create(world.tenantId, buildNewCase(world));

      expect(second).toEqual({ status: 'OPEN_CASE_EXISTS' });
    });

    it('refuses a second open case while the first is in review', async () => {
      const world = await newWorld('index');
      const first = await createCase(world);
      await cases.appendEvent(world.tenantId, first.case.id, {
        expectedSequence: 1,
        event: buildClaim(world.userId),
      });

      const second = await cases.create(world.tenantId, buildNewCase(world));

      expect(second).toEqual({ status: 'OPEN_CASE_EXISTS' });
    });

    it('allows a new case once the earlier one is resolved or withdrawn', async () => {
      const world = await newWorld('reopen');
      const first = await createCase(world);
      await cases.appendEvent(world.tenantId, first.case.id, {
        expectedSequence: 1,
        event: buildClaim(world.userId),
      });
      await cases.appendEvent(world.tenantId, first.case.id, {
        expectedSequence: 2,
        event: buildResolve(world.userId),
      });

      const second = await cases.create(world.tenantId, buildNewCase(world));

      expect(second.status).toBe('CREATED');
    });

    it('creates a source discrepancy case without a revision', async () => {
      const world = await newWorld('discrepancy');
      const newCase = buildNewCase(world, {
        reason: CaseReason.SourceDiscrepancy,
        planRevisionId: null,
        discrepancySubject: DiscrepancySubject.Section,
      });

      const created = await cases.create(world.tenantId, newCase);
      const again = await cases.create(world.tenantId, newCase);

      expect(created.status).toBe('CREATED');
      expect(again.status).toBe('CREATED');
    });

    it('refuses a revision that is another student or tenant', async () => {
      const world = await newWorld('mine');
      const other = await newWorld('theirs');

      const otherStudent = await cases.create(
        world.tenantId,
        buildNewCase(world, { planRevisionId: other.planRevisionId }),
      );
      const missing = await cases.create(
        world.tenantId,
        buildNewCase(world, { planRevisionId: PlanRevisionIdSchema.parse(randomUUID()) }),
      );

      expect(otherStudent).toEqual({ status: 'PLAN_REVISION_NOT_FOUND' });
      expect(missing).toEqual({ status: 'PLAN_REVISION_NOT_FOUND' });
    });

    it('returns STUDENT_NOT_FOUND for a student deleted by the source', async () => {
      const world = await newWorld('deleted');
      await testDatabase.db
        .update(studentTable)
        .set({ isDeleted: true })
        .where(eq(studentTable.id, world.studentId));

      const created = await cases.create(world.tenantId, buildNewCase(world));

      expect(created).toEqual({ status: 'STUDENT_NOT_FOUND' });
    });
  });
});
