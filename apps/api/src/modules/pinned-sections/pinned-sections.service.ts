/**
 * @file Loads a term's latest published section snapshot and the campus transition table,
 * scoped to the session's tenant, and refuses a missing, tied, or out-of-scope snapshot instead
 * of guessing.
 * @module @caa/api/modules/pinned-sections/pinned-sections.service
 * @requirement FR-07
 * @requirement FR-10
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import type {
  CampusTransitionRepository,
  LatestSectionSnapshot,
  SectionSnapshotRepository,
} from '@caa/db';
import type { CampusTransitionPolicy, SectionSnapshot, TermId } from '@caa/domain';

import {
  NotFoundError,
  SourceUnavailableError,
  StaleSourceError,
} from '../../shared/domain-errors';
import type { PinnedRecordsService, RecordScope } from '../pinned-records/pinned-records.service';

/** Dependencies of the pinned sections service. */
export interface PinnedSectionsServiceDependencies {
  readonly sectionSnapshots: SectionSnapshotRepository;
  readonly campusTransitions: CampusTransitionRepository;
  /** Logs why a read is unavailable, in the same shape as the record reasons. */
  readonly pinnedRecords: Pick<PinnedRecordsService, 'recordUnavailable'>;
}

/** The section data and transition table every option of one request is computed from. */
export interface PinnedSections {
  readonly snapshot: SectionSnapshot;
  /** `null` when the tenant has no table; every pair of different campuses is then unknown. */
  readonly transitionPolicy: CampusTransitionPolicy | null;
}

/** Loads the pinned section inputs a schedule read starts from. */
export interface PinnedSectionsService {
  /**
   * Loads the term's latest published section snapshot and the tenant's current transition
   * table. Call only after the actor has been allowed to see the path student.
   *
   * @param scope - The actor, the path student, and the request context.
   * @param termId - The term from the validated body.
   * @returns The pinned snapshot and transition table.
   * @throws {SourceUnavailableError} When the term has no published snapshot.
   * @throws {StaleSourceError} When two snapshots are tied for latest.
   * @throws {NotFoundError} When the snapshot or the table belongs to another tenant or term.
   */
  load(scope: RecordScope, termId: TermId): Promise<PinnedSections>;
}

/**
 * Stops the read when a loaded record isn't the session tenant's, or the snapshot isn't the
 * requested term's.
 *
 * @param scope - The actor, the path student, and the request context.
 * @param record - The loaded snapshot or table, and the term it must be for.
 * @param record.recordId - Opaque ID logged on a mismatch.
 * @param record.isInScope - Whether the record matched the tenant and term.
 * @throws {NotFoundError} On any mismatch, after logging a security event.
 */
function assertInScope(
  scope: RecordScope,
  record: { readonly recordId: string; readonly isInScope: boolean },
): void {
  if (record.isInScope) {
    return;
  }
  const { actor, studentId } = scope;
  // SECURITY: defense in depth (standards/09), checked before any engine call. The repositories
  // already filter by the session's tenant and the term, so this only fires on a data or
  // repository defect. The client sees the same NOT_FOUND as a forbidden student, and the log
  // names opaque IDs only.
  scope.context.logger.warn(
    { actorUserId: actor.userId, tenantId: actor.tenantId, studentId, recordId: record.recordId },
    'section data out of scope',
  );
  throw new NotFoundError();
}

/**
 * Picks the pinned snapshot from the repository's answer.
 *
 * @param dependencies - Logs the unavailable reason.
 * @param scope - The actor, the path student, and the request context.
 * @param latest - The repository's latest snapshot, ambiguity, or `null`.
 * @returns The snapshot every option reads.
 * @throws {SourceUnavailableError} When there is no snapshot.
 * @throws {StaleSourceError} When two snapshots are tied for latest.
 */
function pinSnapshot(
  dependencies: PinnedSectionsServiceDependencies,
  scope: RecordScope,
  latest: LatestSectionSnapshot | null,
): SectionSnapshot {
  // SAFETY: with no published sections there is nothing to schedule, and a tie means the source
  // doesn't say which snapshot is current. Neither is guessed; the student is referred
  // (ADR-0010 §6; planning/07 §Consistency model).
  if (latest === null) {
    dependencies.pinnedRecords.recordUnavailable(scope, 'NO_SECTION_SNAPSHOT');
    throw new SourceUnavailableError();
  }
  if (latest.status === 'AMBIGUOUS') {
    dependencies.pinnedRecords.recordUnavailable(scope, 'SECTION_SNAPSHOT_AMBIGUOUS');
    throw new StaleSourceError();
  }
  return latest.snapshot;
}

/**
 * Creates the pinned sections service.
 *
 * @param dependencies - The section snapshot and transition repositories, and the logger of
 *   unavailable reasons.
 * @returns A {@link PinnedSectionsService}.
 */
export function createPinnedSectionsService(
  dependencies: PinnedSectionsServiceDependencies,
): PinnedSectionsService {
  return {
    async load(scope, termId) {
      // SECURITY: both reads are for the session's tenant only; the term comes from the body
      // and is only ever looked up inside that tenant.
      const { tenantId } = scope.actor;
      const [latest, transitionPolicy] = await Promise.all([
        dependencies.sectionSnapshots.findLatestPublished(tenantId, termId),
        dependencies.campusTransitions.findPolicy(tenantId),
      ]);
      const snapshot = pinSnapshot(dependencies, scope, latest);
      assertInScope(scope, {
        recordId: snapshot.id,
        isInScope: snapshot.tenantId === tenantId && snapshot.termId === termId,
      });
      if (transitionPolicy !== null) {
        assertInScope(scope, {
          recordId: transitionPolicy.version,
          isInScope: transitionPolicy.tenantId === tenantId,
        });
      }
      return { snapshot, transitionPolicy };
    },
  };
}
