/**
 * @file Integration tests for the campus repository against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CampusIdSchema } from '@caa/domain';

import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { insertSectionWorld } from '../testing/section-fixtures';
import { createCampusRepository } from './campus.repository';

describe('CampusRepository.findByIds', () => {
  let testDatabase: TestDatabase;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const setUp = async () =>
    insertSectionWorld(testDatabase.db, await insertTenant(testDatabase.db));

  it("returns the tenant's campuses ordered by id", async () => {
    const world = await setUp();
    const ids = [world.north.id, world.south.id];

    const found = await createCampusRepository(testDatabase.db).findByIds(world.tenantId, ids);

    expect(found.map((campus) => campus.id)).toEqual([...ids].sort());
    expect(found).toContainEqual(world.north);
    expect(found).toContainEqual(world.south);
  });

  it("leaves out another tenant's campus and an unknown ID, without error", async () => {
    const mine = await setUp();
    const theirs = await setUp();
    const unknown = CampusIdSchema.parse('7081a2b3-c4d5-4e6f-8a7b-8c9d0e1f2a3b');

    const found = await createCampusRepository(testDatabase.db).findByIds(mine.tenantId, [
      mine.north.id,
      theirs.north.id,
      unknown,
    ]);

    expect(found).toEqual([mine.north]);
  });

  it('returns an empty list for an empty ID list', async () => {
    const world = await setUp();

    expect(await createCampusRepository(testDatabase.db).findByIds(world.tenantId, [])).toEqual([]);
  });

  it('returns a repeated ID once', async () => {
    const world = await setUp();

    const found = await createCampusRepository(testDatabase.db).findByIds(world.tenantId, [
      world.south.id,
      world.south.id,
    ]);

    expect(found).toEqual([world.south]);
  });
});
