/**
 * @file Proves the QA schedule repository fake lists each term's latest published snapshot head
 * as the `@caa/db` contract states: ordered by term sequence, ties exposed, terms without a
 * snapshot and other tenants' data absent, and an empty list for a tenant with no snapshots.
 * @requirement FR-07
 * @see docs/standards/07-testing.md
 */
import { describe, expect, it } from 'vitest';

import { buildSectionSnapshot, buildTerm, SYNTHETIC_TENANTS } from '@caa/test-kit';

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
});
