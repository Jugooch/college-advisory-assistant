/**
 * @file Proves the QA schedule repository fake lists each term's latest published snapshot head
 * as the `@caa/db` contract states: ordered by term sequence, ties exposed, terms without a
 * snapshot and other tenants' data absent, and an empty list for a tenant with no snapshots.
 * @requirement FR-07
 * @see docs/standards/07-testing.md
 */
import { describe, expect, it } from 'vitest';

import { CampusIdSchema } from '@caa/domain';
import { buildCampus, buildSectionSnapshot, buildTerm, SYNTHETIC_TENANTS } from '@caa/test-kit';

import { createScheduleRepositories } from './schedule-repositories';

const TENANT_A = SYNTHETIC_TENANTS.a.id;
const TENANT_B = SYNTHETIC_TENANTS.b.id;
const FALL = buildTerm({}, 1);
const SPRING = buildTerm({}, 2);
const OTHER_TENANT_TERM = buildTerm({ tenantId: TENANT_B }, 3);

describe('schedule repository fake: listLatestPublishedByTerm', () => {
  it('lists the newest head per term in sequence order, skipping terms with no snapshot', async () => {
    const older = buildSectionSnapshot(
      { termId: FALL.id, sourceEffectiveAt: '2026-01-01T00:00:00.000Z' },
      1,
    );
    const newer = buildSectionSnapshot(
      { termId: FALL.id, sourceEffectiveAt: '2026-02-01T00:00:00.000Z' },
      2,
    );
    const repos = createScheduleRepositories({
      terms: [SPRING, FALL],
      sectionSnapshots: [older, newer],
    });

    const listed = await repos.sectionSnapshots.listLatestPublishedByTerm(TENANT_A);

    expect(listed).toEqual([
      {
        term: FALL,
        latest: {
          status: 'FOUND',
          sectionSnapshotId: newer.id,
          sourceEffectiveAt: '2026-02-01T00:00:00.000Z',
        },
      },
    ]);
  });

  it('exposes a tie for newest as AMBIGUOUS', async () => {
    const at = '2026-02-01T00:00:00.000Z';
    const repos = createScheduleRepositories({
      terms: [FALL],
      sectionSnapshots: [
        buildSectionSnapshot({ termId: FALL.id, sourceEffectiveAt: at }, 1),
        buildSectionSnapshot({ termId: FALL.id, sourceEffectiveAt: at }, 2),
      ],
    });

    const listed = await repos.sectionSnapshots.listLatestPublishedByTerm(TENANT_A);

    expect(listed).toEqual([{ term: FALL, latest: { status: 'AMBIGUOUS' } }]);
  });

  it('returns an empty list for a tenant with no snapshots, never another tenant`s', async () => {
    const repos = createScheduleRepositories({
      terms: [FALL, OTHER_TENANT_TERM],
      sectionSnapshots: [buildSectionSnapshot({ termId: FALL.id }, 1)],
    });

    expect(await repos.sectionSnapshots.listLatestPublishedByTerm(TENANT_B)).toEqual([]);
  });

  it('orders several terms by ascending sequence whatever the stored order', async () => {
    const third = buildTerm({}, 3);
    const repos = createScheduleRepositories({
      terms: [third, FALL, SPRING],
      sectionSnapshots: [
        buildSectionSnapshot({ termId: SPRING.id }, 1),
        buildSectionSnapshot({ termId: third.id }, 2),
        buildSectionSnapshot({ termId: FALL.id }, 3),
      ],
    });

    const listed = await repos.sectionSnapshots.listLatestPublishedByTerm(TENANT_A);

    expect(listed.map((entry) => entry.term.sequence)).toEqual([1, 2, 3]);
  });

  it('returns sourceEffectiveAt in UTC Z form for an offset input', async () => {
    const repos = createScheduleRepositories({
      terms: [FALL],
      sectionSnapshots: [
        buildSectionSnapshot(
          { termId: FALL.id, sourceEffectiveAt: '2026-02-01T05:00:00+02:00' },
          1,
        ),
      ],
    });

    const [entry] = await repos.sectionSnapshots.listLatestPublishedByTerm(TENANT_A);

    expect(entry?.latest).toMatchObject({ sourceEffectiveAt: '2026-02-01T03:00:00.000Z' });
  });
});

describe('schedule repository fake: campuses.findByIds', () => {
  const low = buildCampus({ id: 'd0000000-0000-4000-8000-0000000000a1' }, 3);
  const high = buildCampus({ id: 'd0000000-0000-4000-8000-0000000000b2' }, 4);
  const foreign = buildCampus(
    { id: 'd0000000-0000-4000-8000-0000000000c3', tenantId: TENANT_B },
    5,
  );
  const repos = createScheduleRepositories({ campuses: [high, foreign, low] });

  it('orders by id regardless of the order asked or stored', async () => {
    expect(await repos.campuses.findByIds(TENANT_A, [high.id, low.id])).toEqual([low, high]);
  });

  it("leaves out another tenant's campus", async () => {
    expect(await repos.campuses.findByIds(TENANT_A, [foreign.id, low.id])).toEqual([low]);
    expect(await repos.campuses.findByIds(TENANT_B, [foreign.id])).toEqual([foreign]);
  });

  it('leaves out an unknown id without error', async () => {
    const unknown = CampusIdSchema.parse('d0000000-0000-4000-8000-0000000000ff');
    expect(await repos.campuses.findByIds(TENANT_A, [unknown, high.id])).toEqual([high]);
  });

  it('returns a repeated id once, and nothing for no ids', async () => {
    expect(await repos.campuses.findByIds(TENANT_A, [low.id, low.id, low.id])).toEqual([low]);
    expect(await repos.campuses.findByIds(TENANT_A, [])).toEqual([]);
  });
});
