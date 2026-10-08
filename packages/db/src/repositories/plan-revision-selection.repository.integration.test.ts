/**
 * @file Integration tests of the database rule tying a revision's selection to its outcome and cause.
 * @requirement FR-11
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ScheduleOutcome } from '@caa/domain';

import { planRevisionTable } from '../tables/plan-revision.table';
import { violationOf } from '../testing/catalog-fixtures';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { buildNewRevision, insertPlanWorld } from '../testing/plan-fixtures';
import { createPlanRepository } from './plan.repository';

describe('plan_revision selection rule', () => {
  let testDatabase: TestDatabase;
  let nextRevision: number;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  // NOTE: inserts directly, bypassing the domain schema, so only the database rule is tested.
  const insertRaw = async (
    cause: 'SAVED' | 'REVALIDATED',
    outcome: string,
    selected: boolean,
  ): Promise<void> => {
    const { db } = testDatabase;
    const world = await insertPlanWorld(db, await insertTenant(db), `sel${String(nextRevision++)}`);
    const created = await createPlanRepository(db).createWithFirstRevision(
      world.tenantId,
      { studentId: world.studentId, termId: world.termId, createdAt: '2026-10-01T15:00:00.000Z' },
      buildNewRevision(world),
    );
    if (created.status !== 'CREATED') {
      throw new Error('expected the plan to be created');
    }
    const content = buildNewRevision(world);
    await db.insert(planRevisionTable).values({
      ...content,
      createdAt: new Date(content.createdAt),
      studentRecordEffectiveAt: new Date(content.studentRecordEffectiveAt),
      auditRecordEffectiveAt: new Date(content.auditRecordEffectiveAt),
      tenantId: world.tenantId,
      planId: created.plan.id,
      studentId: world.studentId,
      courseIds: [...content.courseIds],
      revision: 2,
      cause,
      outcome: outcome as ScheduleOutcome,
      selectedSectionIds: selected ? [...(content.selectedSectionIds ?? [])] : null,
    });
  };

  nextRevision = 1;

  it('accepts a saved revision with options and a selection', async () => {
    await expect(insertRaw('SAVED', 'OPTIONS_FOUND', true)).resolves.toBeUndefined();
  });

  it('refuses a saved revision with options and no selection', async () => {
    await expect(insertRaw('SAVED', 'OPTIONS_FOUND', false)).rejects.toMatchObject(
      violationOf('plan_revision_selection_matches_outcome'),
    );
  });

  it('accepts a revalidated revision with options and a selection', async () => {
    await expect(insertRaw('REVALIDATED', 'OPTIONS_FOUND', true)).resolves.toBeUndefined();
  });

  it('accepts a revalidated revision with options and no selection', async () => {
    await expect(insertRaw('REVALIDATED', 'OPTIONS_FOUND', false)).resolves.toBeUndefined();
  });

  it.each(['SAVED', 'REVALIDATED'] as const)(
    'accepts a %s revision without options and no selection',
    async (cause) => {
      await expect(insertRaw(cause, 'NO_FEASIBLE_PLAN', false)).resolves.toBeUndefined();
    },
  );

  it.each(['SAVED', 'REVALIDATED'] as const)(
    'refuses a %s revision without options that has a selection',
    async (cause) => {
      await expect(insertRaw(cause, 'SEARCH_TIMEOUT', true)).rejects.toMatchObject(
        violationOf('plan_revision_selection_matches_outcome'),
      );
    },
  );
});
