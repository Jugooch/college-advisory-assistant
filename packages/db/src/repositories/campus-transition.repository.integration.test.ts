/**
 * @file Integration tests for the campus transition repository and its tables against PostgreSQL.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type CampusTransition, createCampusTransitionPolicy } from '@caa/domain';

import { insertCampusTransitionPolicy } from '../seed/section-snapshot-writer';
import { campusTransitionTable } from '../tables/campus-transition.table';
import { immutableRowRejectionOf, violationOf } from '../testing/catalog-fixtures';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { insertSectionWorld, type SectionWorld } from '../testing/section-fixtures';
import { createCampusTransitionRepository } from './campus-transition.repository';

describe('CampusTransitionRepository.findPolicy', () => {
  let testDatabase: TestDatabase;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const setUp = async (): Promise<SectionWorld> =>
    insertSectionWorld(testDatabase.db, await insertTenant(testDatabase.db));
  const publish = (
    world: SectionWorld,
    version: string,
    options: { readonly at: string; readonly transitions: readonly CampusTransition[] },
  ) => {
    const policy = createCampusTransitionPolicy({
      tenantId: world.tenantId,
      version,
      transitions: options.transitions,
    });
    // NOTE: one transaction, as the writer requires, so a refused pair leaves no version behind.
    return testDatabase.db.transaction((tx) =>
      insertCampusTransitionPolicy(tx, policy, options.at),
    );
  };
  const findPolicy = (world: SectionWorld) =>
    createCampusTransitionRepository(testDatabase.db).findPolicy(world.tenantId);
  const pair = (world: SectionWorld, minutes: number) => ({
    fromCampusId: world.north.id,
    toCampusId: world.south.id,
    minutes,
  });

  it('returns null when the tenant has published no transition table', async () => {
    expect(await findPolicy(await setUp())).toBeNull();
  });

  it('round-trips asymmetric pairs and an explicit zero', async () => {
    const world = await setUp();
    const transitions = [
      pair(world, 0),
      { fromCampusId: world.south.id, toCampusId: world.north.id, minutes: 40 },
    ];
    await publish(world, 'demo-2026.1', { at: '2026-09-01T00:00:00.000Z', transitions });

    const policy = await findPolicy(world);

    expect(policy?.version).toBe('demo-2026.1');
    expect(policy?.transitions).toHaveLength(2);
    expect(policy?.transitions).toEqual(expect.arrayContaining(transitions));
  });

  it('round-trips an empty table, which leaves every pair unknown', async () => {
    const world = await setUp();
    await publish(world, 'demo-2026.1', { at: '2026-09-01T00:00:00.000Z', transitions: [] });

    expect(await findPolicy(world)).toEqual({
      tenantId: world.tenantId,
      version: 'demo-2026.1',
      transitions: [],
    });
  });

  it('returns the version published most recently', async () => {
    const world = await setUp();
    await publish(world, 'demo-2026.2', { at: '2026-09-10T00:00:00.000Z', transitions: [] });
    await publish(world, 'demo-2026.1', {
      at: '2026-09-01T00:00:00.000Z',
      transitions: [pair(world, 30)],
    });

    expect((await findPolicy(world))?.version).toBe('demo-2026.2');
  });

  it('refuses two versions published at the same time', async () => {
    const world = await setUp();
    await publish(world, 'demo-2026.1', { at: '2026-09-01T00:00:00.000Z', transitions: [] });

    const second = publish(world, 'demo-2026.2', {
      at: '2026-09-01T00:00:00.000Z',
      transitions: [],
    });

    await expect(second).rejects.toMatchObject(
      violationOf('campus_transition_version_published_key'),
    );
  });

  it("does not return another tenant's table, and can't use another tenant's campus", async () => {
    const world = await setUp();
    const other = await setUp();
    await publish(world, 'demo-2026.1', { at: '2026-09-01T00:00:00.000Z', transitions: [] });

    const foreign = publish(other, 'demo-2026.1', {
      at: '2026-09-01T00:00:00.000Z',
      transitions: [{ ...pair(other, 10), toCampusId: world.south.id }],
    });

    await expect(foreign).rejects.toMatchObject(violationOf('campus_transition_to_campus_fk'));
    expect(await findPolicy(other)).toBeNull();
  });

  it('refuses a same-campus pair, which needs no transition', async () => {
    const world = await setUp();
    await publish(world, 'demo-2026.1', { at: '2026-09-01T00:00:00.000Z', transitions: [] });

    const insert = testDatabase.db.insert(campusTransitionTable).values({
      tenantId: world.tenantId,
      version: 'demo-2026.1',
      fromCampusId: world.north.id,
      toCampusId: world.north.id,
      minutes: 0,
    });

    await expect(insert).rejects.toMatchObject(violationOf('campus_transition_different_campuses'));
  });

  it('refuses to change a published pair', async () => {
    const world = await setUp();
    await publish(world, 'demo-2026.1', {
      at: '2026-09-01T00:00:00.000Z',
      transitions: [pair(world, 30)],
    });

    const update = testDatabase.db
      .update(campusTransitionTable)
      .set({ minutes: 5 })
      .where(eq(campusTransitionTable.tenantId, world.tenantId));

    await expect(update).rejects.toMatchObject(immutableRowRejectionOf('campus_transition'));
    expect((await findPolicy(world))?.transitions[0]?.minutes).toBe(30);
  });
});
