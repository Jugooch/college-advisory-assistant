/**
 * @file QA-owned in-memory schedule repositories for the API acceptance harness: published section
 * snapshots and campus transition tables. Each follows the documented `@caa/db` repository
 * contract, written here from that contract and not copied from anyone's fakes, so the acceptance
 * oracle stays independent of the code under test (docs/standards/07-testing.md, Acceptance tests).
 * @module @caa/tests/support/schedule-repositories
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/standards/07-testing.md
 */
import type {
  CampusTransitionRepository,
  LatestSectionSnapshot,
  SectionSnapshotRepository,
} from '@caa/db';
import type { CampusTransitionPolicy, SectionSnapshot } from '@caa/domain';

/** Schedule backing data. A field that is omitted means nothing of that kind is stored. */
export interface ScheduleWorld {
  /** Published section snapshots of every term and tenant. */
  sectionSnapshots?: readonly SectionSnapshot[];
  /**
   * Published campus transition tables, oldest publication first. The last one of a tenant is
   * its current table.
   */
  campusTransitionPolicies?: readonly CampusTransitionPolicy[];
}

/**
 * The schedule repositories the schedule-options endpoint (#221) reads. The keys are the ones
 * the harness gives the API's `Repositories`.
 */
export interface ScheduleRepositories {
  readonly sectionSnapshots: SectionSnapshotRepository;
  readonly campusTransitions: CampusTransitionRepository;
}

/**
 * Finds a term's latest published snapshot. As the repository contract states, the strictly
 * newest `sourceEffectiveAt` wins, a tie for newest is `AMBIGUOUS`, never a pick, and another
 * tenant's snapshot is never returned.
 *
 * @param world - Backing data.
 * @param owner - Tenant and term to look up.
 * @param owner.tenantId - Tenant that owns the term.
 * @param owner.termId - Term whose sections are wanted.
 * @returns The latest snapshot, the tie, or null when the term has none in the tenant.
 */
function latestSnapshot(
  world: ScheduleWorld,
  owner: { readonly tenantId: string; readonly termId: string },
): LatestSectionSnapshot | null {
  const own = (world.sectionSnapshots ?? []).filter(
    (item) => item.tenantId === owner.tenantId && item.termId === owner.termId,
  );
  const newestAt = Math.max(...own.map((item) => Date.parse(item.sourceEffectiveAt)));
  const [only, ...tied] = own.filter((item) => Date.parse(item.sourceEffectiveAt) === newestAt);
  if (only === undefined) {
    return null;
  }
  return tied.length > 0 ? { status: 'AMBIGUOUS' } : { status: 'FOUND', snapshot: only };
}

/**
 * Creates the schedule repositories over the world, each scoped to the tenant it is asked for.
 *
 * @param world - Backing data. Read on every call, so a case can change it between requests.
 * @returns The schedule repositories.
 */
export function createScheduleRepositories(world: ScheduleWorld): ScheduleRepositories {
  return {
    sectionSnapshots: {
      findLatestPublished: (tenantId, termId) =>
        Promise.resolve(latestSnapshot(world, { tenantId, termId })),
    },
    campusTransitions: {
      findPolicy: (tenantId) =>
        Promise.resolve(
          (world.campusTransitionPolicies ?? [])
            .filter((item) => item.tenantId === tenantId)
            .at(-1) ?? null,
        ),
    },
  };
}
