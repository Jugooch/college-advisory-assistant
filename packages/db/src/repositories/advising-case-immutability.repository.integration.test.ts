/**
 * @file Integration tests that the database itself keeps case events append-only and a case's
 *   identity fixed.
 */
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CaseStatus } from '@caa/domain';

import { advisingCaseTable } from '../tables/advising-case.table';
import { caseEventTable } from '../tables/case-event.table';
import { buildNewCase, insertCaseWorld } from '../testing/case-fixtures';
import { immutableRowRejectionOf } from '../testing/catalog-fixtures';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { createAdvisingCaseRepository } from './advising-case.repository';

describe('advising case immutability', () => {
  let testDatabase: TestDatabase;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const createCase = async (label: string) => {
    const { db } = testDatabase;
    const world = await insertCaseWorld(db, await insertTenant(db), label);
    const created = await createAdvisingCaseRepository(db).create(
      world.tenantId,
      buildNewCase(world),
    );
    if (created.status !== 'CREATED') {
      throw new Error('expected the case to be created');
    }
    return { world, created };
  };

  it('refuses to update or delete a stored event', async () => {
    const { created } = await createCase('event');
    const { db } = testDatabase;

    await expect(
      db.update(caseEventTable).set({ note: 'x' }).where(eq(caseEventTable.id, created.event.id)),
    ).rejects.toMatchObject(immutableRowRejectionOf('case_event'));
    await expect(
      db.delete(caseEventTable).where(eq(caseEventTable.id, created.event.id)),
    ).rejects.toMatchObject(immutableRowRejectionOf('case_event'));
  });

  it('refuses to truncate events or cases, and to delete a case', async () => {
    const { created } = await createCase('truncate');
    const { db } = testDatabase;

    await expect(db.execute(sql`TRUNCATE "case_event"`)).rejects.toMatchObject(
      immutableRowRejectionOf('case_event'),
    );
    await expect(db.execute(sql`TRUNCATE "advising_case" CASCADE`)).rejects.toBeDefined();
    await expect(
      db.delete(advisingCaseTable).where(eq(advisingCaseTable.id, created.case.id)),
    ).rejects.toMatchObject(immutableRowRejectionOf('advising_case'));
  });

  it("refuses to change a case's student, note or revision", async () => {
    const { created } = await createCase('identity');
    const { db } = testDatabase;

    const change = db
      .update(advisingCaseTable)
      .set({ studentNote: 'rewritten', lastSequence: 2 })
      .where(eq(advisingCaseTable.id, created.case.id));

    await expect(change).rejects.toMatchObject(immutableRowRejectionOf('advising_case'));
  });

  it('refuses a status change that does not advance the sequence by one', async () => {
    const { created } = await createCase('sequence');
    const { db } = testDatabase;

    const skip = db
      .update(advisingCaseTable)
      .set({ status: CaseStatus.Withdrawn, lastSequence: 3 })
      .where(eq(advisingCaseTable.id, created.case.id));

    await expect(skip).rejects.toMatchObject(immutableRowRejectionOf('advising_case'));
  });

  it('refuses an event that does not match the case state', async () => {
    const { world, created } = await createCase('mismatch');
    const { db } = testDatabase;

    const stray = db.insert(caseEventTable).values({
      tenantId: world.tenantId,
      caseId: created.case.id,
      sequence: 2,
      action: 'CLAIM',
      actorUserId: world.userId,
      at: new Date('2026-10-02T10:00:00.000Z'),
      fromStatus: 'OPEN',
      toStatus: 'IN_REVIEW',
    });

    await expect(stray).rejects.toMatchObject(immutableRowRejectionOf('case_event'));
  });
});
