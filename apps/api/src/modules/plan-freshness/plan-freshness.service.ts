/**
 * @file Reads the current latest sources for a saved revision and derives its freshness. A source
 * that can't be read gives UNKNOWN; it never fails the read of the historical revision (AC14).
 * @module @caa/api/modules/plan-freshness/plan-freshness.service
 * @requirement FR-11
 * @requirement NFR-05
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { PlanFreshnessView } from '@caa/api-contract';
import type {
  AuditSnapshotRepository,
  CampusTransitionRepository,
  SectionSnapshotRepository,
  StudentSnapshotRepository,
} from '@caa/db';
import type { Actor, PlanRevision, StudentId } from '@caa/domain';

import type { RequestContext } from '../../shared/request-context';
import {
  computePlanFreshness,
  type CurrentSources,
  type SourceReading,
} from './plan-freshness.logic';

/** Dependencies of the plan freshness service. */
export interface PlanFreshnessServiceDependencies {
  readonly studentSnapshots: Pick<StudentSnapshotRepository, 'findLatest'>;
  readonly auditSnapshots: Pick<AuditSnapshotRepository, 'findLatest'>;
  readonly sectionSnapshots: Pick<SectionSnapshotRepository, 'findLatestPublished'>;
  readonly campusTransitions: CampusTransitionRepository;
  /** The injected clock. */
  readonly now: () => Date;
  /** Validated `ACADEMIC_SOURCE_MAX_AGE_MS`. */
  readonly maxSourceAgeMs: number;
  /** The active ruleset version, or null when none is configured. */
  readonly rulesetVersion: string | null;
}

/** What a freshness check is for: one revision of one student's plan. */
export interface FreshnessTarget {
  readonly studentId: StudentId;
  readonly revision: PlanRevision;
}

/** Derives the freshness of saved plan revisions. */
export interface PlanFreshnessService {
  /**
   * Compares a revision's pinned inputs with the current latest sources.
   *
   * @param actor - Authenticated actor; its tenant scopes every read.
   * @param target - The student and the revision.
   * @param context - Request-scoped values.
   * @returns The state, reasons, and check time. Never throws for an unreadable source.
   */
  assess(
    actor: Actor,
    target: FreshnessTarget,
    context: RequestContext,
  ): Promise<PlanFreshnessView>;
}

/**
 * Runs one source read, turning a missing result, a tie, or a failure into UNAVAILABLE.
 *
 * @param read - Reads the source and extracts the value, or null when there is none to use.
 * @param label - Opaque name of the source, for the log line.
 * @param context - Request-scoped values.
 * @returns The reading.
 */
async function readSource<T>(
  read: () => Promise<T | null>,
  label: string,
  context: RequestContext,
): Promise<SourceReading<T>> {
  try {
    const value = await read();
    return value === null ? { status: 'UNAVAILABLE' } : { status: 'FOUND', value };
  } catch {
    // NOTE: the error is dropped on purpose; it may carry stored values. Opaque label only.
    context.logger.warn({ source: label }, 'plan freshness source unreadable');
    return { status: 'UNAVAILABLE' };
  }
}

/** Which student's sources, in which tenant and term, a comparison reads. */
interface SourceScope {
  readonly tenantId: Actor['tenantId'];
  readonly studentId: StudentId;
  readonly termId: PlanRevision['termId'];
}

/**
 * Reads the current latest source IDs, each independently, so one failure leaves the rest.
 *
 * @param dependencies - The source repositories, ruleset, and clock settings.
 * @param scope - The tenant, student, and term.
 * @param context - Request-scoped values.
 * @returns The readings; an unreadable source is UNAVAILABLE.
 */
async function readCurrentSources(
  dependencies: PlanFreshnessServiceDependencies,
  scope: SourceScope,
  context: RequestContext,
): Promise<CurrentSources> {
  // SECURITY: every read is for the session's tenant and the plan's student and term.
  const { tenantId, studentId, termId } = scope;
  const [studentSnapshotId, auditSnapshotId, sectionSnapshot, transition] = await Promise.all([
    readSource(
      async () => {
        const latest = await dependencies.studentSnapshots.findLatest(tenantId, studentId);
        return latest?.status === 'FOUND' ? latest.revision.snapshot.id : null;
      },
      'studentSnapshot',
      context,
    ),
    readSource(
      async () => {
        const latest = await dependencies.auditSnapshots.findLatest(tenantId, studentId);
        return latest?.status === 'FOUND' ? latest.audit.id : null;
      },
      'audit',
      context,
    ),
    readSource(
      async () => {
        const latest = await dependencies.sectionSnapshots.findLatestPublished(tenantId, termId);
        return latest?.status === 'FOUND'
          ? { id: latest.snapshot.id, sourceEffectiveAt: latest.snapshot.sourceEffectiveAt }
          : null;
      },
      'sectionSnapshot',
      context,
    ),
    // NOTE: wrapped so "no table" (a null policy) stays a found, null version.
    readSource(
      async () => ({
        version: (await dependencies.campusTransitions.findPolicy(tenantId))?.version ?? null,
      }),
      'campusTransition',
      context,
    ),
  ]);
  const { rulesetVersion } = dependencies;
  return {
    studentSnapshotId,
    auditSnapshotId,
    sectionSnapshot,
    // SAFETY: with no configured ruleset the comparison can't be made, so it is UNKNOWN.
    rulesetVersion:
      rulesetVersion === null
        ? { status: 'UNAVAILABLE' }
        : { status: 'FOUND', value: rulesetVersion },
    campusTransitionVersion:
      transition.status === 'FOUND'
        ? { status: 'FOUND', value: transition.value.version }
        : { status: 'UNAVAILABLE' },
  };
}

/**
 * Creates the plan freshness service.
 *
 * @param dependencies - Source repositories, the clock, the age limit, and the ruleset.
 * @returns A {@link PlanFreshnessService}.
 */
export function createPlanFreshnessService(
  dependencies: PlanFreshnessServiceDependencies,
): PlanFreshnessService {
  return {
    async assess(actor, target, context) {
      const { studentId, revision } = target;
      const scope = { tenantId: actor.tenantId, studentId, termId: revision.termId };
      const current = await readCurrentSources(dependencies, scope, context);
      return computePlanFreshness(revision, current, {
        now: dependencies.now(),
        maxAgeMs: dependencies.maxSourceAgeMs,
      });
    },
  };
}
