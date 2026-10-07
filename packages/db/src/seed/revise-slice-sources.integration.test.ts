/**
 * @file Integration tests for the dev revise command against PostgreSQL. It runs in its own
 *   database because a newer revision becomes the latest truth for every later reader.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  InstitutionIdSchema,
  StudentIdSchema,
  StudentSnapshotIdSchema,
  TermIdSchema,
} from '@caa/domain';

import { createSectionSnapshotRepository } from '../repositories/section-snapshot.repository';
import { createStudentSnapshotRepository } from '../repositories/student-snapshot.repository';
import type { TestDatabase } from '../testing/integration-fixtures';
import { openIsolatedTestDatabase } from '../testing/isolated-database';
import { buildDevSeedPlan } from './dev-seed-plan';
import { buildStudentRevision } from './dev-seed-revision-plan';
import { buildWithdrawnSectionSnapshot } from './dev-seed-section-plan';
import { ReviseNotNewerError, reviseSliceSources } from './revise-slice-sources';
import { seedDevData } from './seed-dev-data';

const SEED_RUN = new Date('2026-10-01T12:00:00.000Z');
const PLAN = buildDevSeedPlan(SEED_RUN);
const TENANT = InstitutionIdSchema.parse(PLAN.institutions[0]?.id);
const STUDENT = StudentIdSchema.parse(PLAN.academic.snapshots[0]?.studentId);
const TERM = TermIdSchema.parse(PLAN.sections.snapshot.termId);
const HOUR_MS = 3_600_000;
const FIRST = new Date(SEED_RUN.getTime() + HOUR_MS);
const SECOND = new Date(SEED_RUN.getTime() + 2 * HOUR_MS);

describe('reviseSliceSources', () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await openIsolatedTestDatabase();
    await seedDevData(testDatabase.db, PLAN);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  it('appends a newer student record and leaves the earlier snapshot untouched', async () => {
    const snapshots = createStudentSnapshotRepository(testDatabase.db);
    const seeded = await snapshots.findLatest(TENANT, STUDENT);

    const result = await reviseSliceSources(testDatabase.db, 'student', FIRST);

    const expected = buildStudentRevision(FIRST, STUDENT);
    const latest = await snapshots.findLatest(TENANT, STUDENT);
    expect(result).toEqual({ target: 'student', published: true });
    expect(latest).toMatchObject({ status: 'FOUND', revision: { snapshot: expected.snapshot } });
    expect(
      await snapshots.findById(
        TENANT,
        StudentSnapshotIdSchema.parse(PLAN.academic.snapshots[0]?.id),
      ),
    ).toEqual(seeded?.status === 'FOUND' ? seeded.revision : null);
  });

  it('makes another newer student revision on a re-run and none for the same run time', async () => {
    const snapshots = createStudentSnapshotRepository(testDatabase.db);
    await reviseSliceSources(testDatabase.db, 'student', FIRST);

    const again = await reviseSliceSources(testDatabase.db, 'student', SECOND);
    const repeat = await reviseSliceSources(testDatabase.db, 'student', SECOND);

    const latest = await snapshots.findLatest(TENANT, STUDENT);
    expect(again.published).toBe(true);
    expect(repeat.published).toBe(false);
    expect(latest).toMatchObject({
      status: 'FOUND',
      revision: { snapshot: buildStudentRevision(SECOND, STUDENT).snapshot },
    });
  });

  it('refuses a run that is not newer than the latest and changes nothing', async () => {
    const snapshots = createStudentSnapshotRepository(testDatabase.db);
    const before = await snapshots.findLatest(TENANT, STUDENT);

    await expect(
      reviseSliceSources(testDatabase.db, 'student', new Date(FIRST.getTime() - HOUR_MS)),
    ).rejects.toBeInstanceOf(ReviseNotNewerError);

    expect(await snapshots.findLatest(TENANT, STUDENT)).toEqual(before);
  });

  it('appends a newer section snapshot with MATH 102 002 withdrawn, keeping the earlier one', async () => {
    const sections = createSectionSnapshotRepository(testDatabase.db);

    const result = await reviseSliceSources(testDatabase.db, 'sections', FIRST);

    const latest = await sections.findLatestPublished(TENANT, TERM);
    expect(result).toEqual({ target: 'sections', published: true });
    expect(latest).toEqual({ status: 'FOUND', snapshot: buildWithdrawnSectionSnapshot(FIRST) });
    expect(await reviseSliceSources(testDatabase.db, 'sections', SECOND)).toMatchObject({
      published: true,
    });
    expect(await reviseSliceSources(testDatabase.db, 'sections', SECOND)).toMatchObject({
      published: false,
    });
    await expect(
      reviseSliceSources(testDatabase.db, 'sections', new Date(SEED_RUN.getTime())),
    ).rejects.toBeInstanceOf(ReviseNotNewerError);
  });
});
