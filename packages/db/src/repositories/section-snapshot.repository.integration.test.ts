/**
 * @file Integration tests for the section snapshot repository and its tables against PostgreSQL.
 */
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { sectionTable } from '../tables/section.table';
import { sectionLinkMemberTable } from '../tables/section-link-group.table';
import { sectionMeetingTable } from '../tables/section-meeting.table';
import { sectionSnapshotTable } from '../tables/section-snapshot.table';
import { immutableRowRejectionOf, insertTerm, violationOf } from '../testing/catalog-fixtures';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import {
  insertSectionWorld,
  publishSectionSnapshot,
  type SectionWorld,
} from '../testing/section-fixtures';
import { createSectionSnapshotRepository } from './section-snapshot.repository';

describe('SectionSnapshotRepository.findLatestPublished', () => {
  let testDatabase: TestDatabase;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const setUp = async (): Promise<SectionWorld> =>
    insertSectionWorld(testDatabase.db, await insertTenant(testDatabase.db));
  const latest = (world: SectionWorld) =>
    createSectionSnapshotRepository(testDatabase.db).findLatestPublished(
      world.tenantId,
      world.termId,
    );

  it('round-trips a snapshot with every meeting shape and its linked groups', async () => {
    const world = await setUp();
    const snapshot = await publishSectionSnapshot(testDatabase.db, world);

    expect(await latest(world)).toEqual({ status: 'FOUND', snapshot });
  });

  it('stores a to-be-announced time as null, never as midnight', async () => {
    const world = await setUp();
    const snapshot = await publishSectionSnapshot(testDatabase.db, world);
    const tba = snapshot.sections.find((section) => section.sourceSectionId === 'SYN-SEC-3');

    const [row] = await testDatabase.db
      .select()
      .from(sectionMeetingTable)
      .where(eq(sectionMeetingTable.sectionId, tba?.id ?? ''));

    expect(row).toMatchObject({
      weekdays: null,
      startTime: null,
      endTime: null,
      locationKind: null,
    });
  });

  it('picks the newest source time, not the newest ingestion', async () => {
    const world = await setUp();
    const newer = await publishSectionSnapshot(testDatabase.db, world, {
      sourceEffectiveAt: '2026-09-26T06:00:00.000Z',
    });
    await publishSectionSnapshot(testDatabase.db, world, {
      sourceEffectiveAt: '2026-09-20T06:00:00.000Z',
    });

    const found = await latest(world);

    expect(found?.status === 'FOUND' && found.snapshot.id).toBe(newer.id);
  });

  it('reports AMBIGUOUS when two snapshots share the newest source time', async () => {
    const world = await setUp();
    await publishSectionSnapshot(testDatabase.db, world);
    await publishSectionSnapshot(testDatabase.db, world);

    expect(await latest(world)).toEqual({ status: 'AMBIGUOUS' });
  });

  it("returns null for a term with no snapshot and for another tenant's term", async () => {
    const world = await setUp();
    await publishSectionSnapshot(testDatabase.db, world);
    const other = await setUp();

    expect(await latest(other)).toBeNull();
    expect(
      await createSectionSnapshotRepository(testDatabase.db).findLatestPublished(
        other.tenantId,
        world.termId,
      ),
    ).toBeNull();
  });

  it('exposes no method that changes a snapshot', () => {
    expect(Object.keys(createSectionSnapshotRepository(testDatabase.db))).toEqual([
      'findLatestPublished',
      'listLatestPublishedByTerm',
    ]);
  });

  it("can't store a section of another tenant's course", async () => {
    const world = await setUp();
    const other = await setUp();

    const publish = publishSectionSnapshot(testDatabase.db, { ...world, math: other.math });

    await expect(publish).rejects.toMatchObject(violationOf('section_course_fk'));
  });

  it("can't link a permitted section of a course other than its component's", async () => {
    const world = await setUp();
    const snapshot = await publishSectionSnapshot(testDatabase.db, world);
    const [group] = snapshot.linkedSectionGroups;
    const mathSection = snapshot.sections[0];

    const insert = testDatabase.db.insert(sectionLinkMemberTable).values({
      tenantId: world.tenantId,
      sectionSnapshotId: snapshot.id,
      groupId: group?.id ?? '',
      componentPosition: 1,
      courseId: world.phys,
      sectionId: mathSection?.id ?? '',
      position: 0,
    });

    await expect(insert).rejects.toMatchObject(violationOf('section_link_member_section_fk'));
  });

  it('fails loudly when a stored meeting is invalid', async () => {
    const world = await setUp();
    const snapshot = await publishSectionSnapshot(testDatabase.db, world);

    // NOTE: an excluded date outside the meeting's dates passes the table checks but not the
    // domain schema, so the mapper must refuse it.
    await testDatabase.db.insert(sectionMeetingTable).values({
      tenantId: world.tenantId,
      sectionId: snapshot.sections[0]?.id ?? '',
      position: 1,
      weekdays: null,
      startTime: null,
      endTime: null,
      startsOn: '2026-08-24',
      endsOn: '2026-09-30',
      excludedDates: ['2026-11-26'],
    });

    await expect(latest(world)).rejects.toThrow(ZodError);
  });

  it('refuses to store a half-known meeting time', async () => {
    const world = await setUp();
    const snapshot = await publishSectionSnapshot(testDatabase.db, world);

    const insert = testDatabase.db.insert(sectionMeetingTable).values({
      tenantId: world.tenantId,
      sectionId: snapshot.sections[0]?.id ?? '',
      position: 1,
      startTime: '09:00',
      startsOn: '2026-08-24',
      endsOn: '2026-09-30',
      excludedDates: [],
    });

    await expect(insert).rejects.toMatchObject(violationOf('section_meeting_time_range'));
  });

  it('refuses to update or delete a published snapshot, section, or meeting', async () => {
    const world = await setUp();
    const snapshot = await publishSectionSnapshot(testDatabase.db, world);
    const { db } = testDatabase;
    const section = eq(sectionTable.id, snapshot.sections[0]?.id ?? '');

    await expect(
      db
        .update(sectionSnapshotTable)
        .set({ timezone: 'UTC' })
        .where(eq(sectionSnapshotTable.id, snapshot.id)),
    ).rejects.toMatchObject(immutableRowRejectionOf('section_snapshot'));
    await expect(db.delete(sectionTable).where(section)).rejects.toMatchObject(
      immutableRowRejectionOf('section'),
    );
    await expect(
      db
        .update(sectionMeetingTable)
        .set({ room: 'SCI 999' })
        .where(
          and(
            eq(sectionMeetingTable.tenantId, world.tenantId),
            eq(sectionMeetingTable.position, 0),
          ),
        ),
    ).rejects.toMatchObject(immutableRowRejectionOf('section_meeting'));
    expect(await latest(world)).toEqual({ status: 'FOUND', snapshot });
  });

  it('refuses to truncate published sections', async () => {
    const truncate = testDatabase.db.transaction(async (tx) => {
      await tx.execute(sql`TRUNCATE TABLE section_link_member`);
      tx.rollback();
    });

    await expect(truncate).rejects.toMatchObject(immutableRowRejectionOf('section_link_member'));
  });
});

describe('SectionSnapshotRepository.listLatestPublishedByTerm', () => {
  let testDatabase: TestDatabase;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const setUp = async (): Promise<SectionWorld> =>
    insertSectionWorld(testDatabase.db, await insertTenant(testDatabase.db));
  const list = (world: SectionWorld) =>
    createSectionSnapshotRepository(testDatabase.db).listLatestPublishedByTerm(world.tenantId);

  it('lists found and tied terms in sequence order and omits a term with no snapshot', async () => {
    const world = await setUp();
    const { db } = testDatabase;
    const spring = await insertTerm(db, world.tenantId, { termCode: '2027SP', sequence: 2 });
    const summer = await insertTerm(db, world.tenantId, { termCode: '2027SU', sequence: 3 });
    const tiedWorld = { ...world, termId: summer };
    await publishSectionSnapshot(db, world, { sourceEffectiveAt: '2026-09-20T06:00:00.000Z' });
    const newer = await publishSectionSnapshot(db, world, {
      sourceEffectiveAt: '2026-09-26T06:00:00.000Z',
    });
    await publishSectionSnapshot(db, tiedWorld);
    await publishSectionSnapshot(db, tiedWorld);

    const entries = await list(world);

    expect(entries.map((entry) => entry.term.id)).toEqual([world.termId, summer]);
    expect(entries.map((entry) => entry.term.id)).not.toContain(spring);
    expect(entries[0]?.latest).toEqual({
      status: 'FOUND',
      sectionSnapshotId: newer.id,
      sourceEffectiveAt: '2026-09-26T06:00:00.000Z',
    });
    expect(entries[1]?.latest).toEqual({ status: 'AMBIGUOUS' });
  });

  it('lets a later-ingested older snapshot lose', async () => {
    const world = await setUp();
    const newer = await publishSectionSnapshot(testDatabase.db, world, {
      sourceEffectiveAt: '2026-09-26T06:00:00.000Z',
    });
    await publishSectionSnapshot(testDatabase.db, world, {
      sourceEffectiveAt: '2026-09-20T06:00:00.000Z',
    });

    const [entry] = await list(world);

    expect(entry?.latest).toMatchObject({ status: 'FOUND', sectionSnapshotId: newer.id });
  });

  it("excludes another tenant's terms, including the same term code", async () => {
    const world = await setUp();
    const other = await setUp();
    await publishSectionSnapshot(testDatabase.db, other);

    expect(await list(world)).toEqual([]);
    expect((await list(other)).map((entry) => entry.term.tenantId)).toEqual([other.tenantId]);
  });

  it('returns an empty list for a tenant with no snapshots', async () => {
    expect(await list(await setUp())).toEqual([]);
  });

  it('agrees with findLatestPublished for every term', async () => {
    const world = await setUp();
    const { db } = testDatabase;
    const tiedTerm = await insertTerm(db, world.tenantId, { termCode: '2027SP', sequence: 2 });
    await publishSectionSnapshot(db, world);
    await publishSectionSnapshot(db, { ...world, termId: tiedTerm });
    await publishSectionSnapshot(db, { ...world, termId: tiedTerm });
    const repository = createSectionSnapshotRepository(db);

    for (const { term, latest } of await list(world)) {
      const found = await repository.findLatestPublished(world.tenantId, term.id);
      expect(
        found?.status === 'FOUND'
          ? { status: 'FOUND', sectionSnapshotId: found.snapshot.id }
          : found,
      ).toEqual(
        latest.status === 'FOUND'
          ? { status: 'FOUND', sectionSnapshotId: latest.sectionSnapshotId }
          : latest,
      );
    }
  });
});
