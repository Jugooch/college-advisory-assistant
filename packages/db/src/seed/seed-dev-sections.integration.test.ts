/**
 * @file Integration tests for the dev seed's scheduling data against PostgreSQL: the 2027SP
 *   section snapshot and the campus transition table read back exactly as planned.
 *
 * It seeds the same run as `seed-dev-data.integration.test.ts`, which writes nothing new, so the
 * row counts that file asserts hold whichever file runs first.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InstitutionIdSchema, TermIdSchema } from '@caa/domain';

import { createCampusTransitionRepository } from '../repositories/campus-transition.repository';
import { createSectionSnapshotRepository } from '../repositories/section-snapshot.repository';
import { openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { buildDevSeedPlan } from './dev-seed-plan';
import { SEED_TIME_OFFSETS_MS } from './dev-seed-record-times';
import { seedDevData } from './seed-dev-data';

/** The same run `seed-dev-data.integration.test.ts` seeds first. */
const FIRST_RUN = new Date('2026-10-01T12:00:00.000Z');
const PLAN = buildDevSeedPlan(FIRST_RUN);
const TENANT_A = InstitutionIdSchema.parse(PLAN.institutions[0]?.id);
const PLANNING_TERM = TermIdSchema.parse(PLAN.sections.snapshot.termId);

describe('seedDevData scheduling data', () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = openTestDatabase();
    await seedDevData(testDatabase.db, PLAN);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  it("reads back the latest 2027SP snapshot exactly as its run's plan built it", async () => {
    const latest = await createSectionSnapshotRepository(testDatabase.db).findLatestPublished(
      TENANT_A,
      PLANNING_TERM,
    );
    // NOTE: the other seed test may already have added a later run. Every run publishes its
    // snapshot a fixed offset before the run, so the run is recovered from the snapshot's time.
    const published = latest?.status === 'FOUND' ? latest.snapshot.sourceEffectiveAt : '';
    const run = new Date(Date.parse(published) + SEED_TIME_OFFSETS_MS.currentRecordAge);

    expect(latest).toEqual({ status: 'FOUND', snapshot: buildDevSeedPlan(run).sections.snapshot });
  });

  it('reads back the fixed transition table', async () => {
    const policy = await createCampusTransitionRepository(testDatabase.db).findPolicy(TENANT_A);

    expect(policy).toEqual(PLAN.sections.transitionPolicy);
  });

  it('seeds the same run again without touching the published, immutable rows', async () => {
    const snapshots = createSectionSnapshotRepository(testDatabase.db);
    const before = await snapshots.findLatestPublished(TENANT_A, PLANNING_TERM);

    // NOTE: section rows reject UPDATE and DELETE, so this only passes if a re-run inserts
    // nothing and changes nothing.
    await seedDevData(testDatabase.db, PLAN);

    expect(await snapshots.findLatestPublished(TENANT_A, PLANNING_TERM)).toEqual(before);
  });
});
