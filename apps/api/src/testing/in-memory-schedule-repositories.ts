/**
 * @file In-memory fakes of the schedule repositories for API tests: published section snapshots
 * and campus transition tables. Test code only; never wired by the container.
 * @module @caa/api/testing/in-memory-schedule-repositories
 * @see docs/standards/07-testing.md
 */
import type {
  CampusTransitionRepository,
  LatestSectionSnapshot,
  SectionSnapshotRepository,
} from '@caa/db';
import type { CampusTransitionPolicy, SectionSnapshot } from '@caa/domain';

/** Schedule backing data. Every field omitted means none stored. */
export interface InMemoryScheduleStore {
  sectionSnapshots?: readonly SectionSnapshot[];
  /** At most one table per tenant: the current one. */
  transitionPolicies?: readonly CampusTransitionPolicy[];
}

/** The schedule repositories the fakes implement. */
export interface InMemoryScheduleRepositories {
  readonly sectionSnapshots: SectionSnapshotRepository;
  readonly campusTransitions: CampusTransitionRepository;
}

/**
 * Finds the term's snapshot with the strictly newest source time, like the PostgreSQL
 * repository: a tie is `AMBIGUOUS`, never a pick.
 *
 * @param store - Backing data.
 * @param tenantId - Tenant that owns the term.
 * @param termId - The term.
 * @returns The latest snapshot, the ambiguity, or null when there is none.
 */
function findLatestPublished(
  store: InMemoryScheduleStore,
  tenantId: string,
  termId: string,
): LatestSectionSnapshot | null {
  const [newest, runnerUp] = (store.sectionSnapshots ?? [])
    .filter((snapshot) => snapshot.tenantId === tenantId && snapshot.termId === termId)
    .toSorted(
      (left, right) => Date.parse(right.sourceEffectiveAt) - Date.parse(left.sourceEffectiveAt),
    );
  if (newest === undefined) {
    return null;
  }
  if (
    runnerUp !== undefined &&
    Date.parse(runnerUp.sourceEffectiveAt) === Date.parse(newest.sourceEffectiveAt)
  ) {
    return { status: 'AMBIGUOUS' };
  }
  return { status: 'FOUND', snapshot: newest };
}

/**
 * Creates the schedule repositories over the store, filtered by tenant like PostgreSQL.
 *
 * @param store - Backing data. Read on every call.
 * @returns Every schedule repository.
 */
export function createInMemoryScheduleRepositories(
  store: InMemoryScheduleStore,
): InMemoryScheduleRepositories {
  return {
    sectionSnapshots: {
      findLatestPublished: (tenantId, termId) =>
        Promise.resolve(findLatestPublished(store, tenantId, termId)),
    },
    campusTransitions: {
      findPolicy: (tenantId) =>
        Promise.resolve(
          (store.transitionPolicies ?? []).find((policy) => policy.tenantId === tenantId) ?? null,
        ),
    },
  };
}
