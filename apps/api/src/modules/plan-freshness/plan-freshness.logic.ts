/**
 * @file Pure rule that says whether a saved plan revision is still current, stale, or unknown.
 * Staleness is derived at read time and never stored (ADR-0013 §3).
 * @module @caa/api/modules/plan-freshness/plan-freshness.logic
 * @requirement FR-11
 * @requirement NFR-05
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { PlanFreshnessView } from '@caa/api-contract';
import { PlanFreshness, type PlanRevision, PlanStaleReason } from '@caa/domain';

import { type FreshnessPolicy, isSourceFresh } from '../source-freshness/source-freshness.logic';

/** What reading one current source produced. */
export type SourceReading<T> =
  { readonly status: 'FOUND'; readonly value: T } | { readonly status: 'UNAVAILABLE' };

/** The latest section snapshot's ID and source time. */
export interface CurrentSectionSnapshot {
  readonly id: string;
  readonly sourceEffectiveAt: string;
}

/** The current latest source IDs for the revision's student, tenant, and term. */
export interface CurrentSources {
  readonly studentSnapshotId: SourceReading<string>;
  readonly auditSnapshotId: SourceReading<string>;
  readonly sectionSnapshot: SourceReading<CurrentSectionSnapshot>;
  readonly rulesetVersion: SourceReading<string>;
  /** The transition table's version, or null when the tenant has none. */
  readonly campusTransitionVersion: SourceReading<string | null>;
}

/** The pinned inputs of a revision that freshness compares. */
export type PinnedRevisionInputs = Pick<
  PlanRevision,
  | 'studentSnapshotId'
  | 'studentRecordEffectiveAt'
  | 'auditSnapshotId'
  | 'auditRecordEffectiveAt'
  | 'rulesetVersion'
  | 'sectionSnapshotId'
  | 'campusTransitionVersion'
>;

/**
 * Checks whether a reading was found and differs from the pinned value.
 *
 * @param reading - The current latest value.
 * @param pinned - The value the revision pinned.
 * @returns True only when the source was read and has moved on.
 */
function isSuperseded<T>(reading: SourceReading<T>, pinned: T): boolean {
  return reading.status === 'FOUND' && reading.value !== pinned;
}

/**
 * Lists the reasons a revision is stale that the readings prove, in a fixed order.
 *
 * @param pinned - The revision's pinned inputs.
 * @param current - The current latest sources.
 * @param policy - The clock reading and the maximum source age.
 * @returns The proven stale reasons; empty when none is proven.
 */
function provenReasons(
  pinned: PinnedRevisionInputs,
  current: CurrentSources,
  policy: FreshnessPolicy,
): PlanStaleReason[] {
  const { sectionSnapshot } = current;
  const pinnedSectionTime =
    sectionSnapshot.status === 'FOUND' && sectionSnapshot.value.id === pinned.sectionSnapshotId
      ? sectionSnapshot.value.sourceEffectiveAt
      : null;
  // SAFETY: a pinned time past the age makes the revision historical only, however recent the
  // comparison (planning/09 §Proposed freshness policies). The section time is known only while
  // the pinned snapshot is still the latest; a superseded one is stale for that reason already.
  const isExpired =
    !isSourceFresh(pinned.studentRecordEffectiveAt, policy) ||
    !isSourceFresh(pinned.auditRecordEffectiveAt, policy) ||
    (pinnedSectionTime !== null && !isSourceFresh(pinnedSectionTime, policy));
  const checks: readonly (readonly [PlanStaleReason, boolean])[] = [
    [
      PlanStaleReason.StudentRecordSuperseded,
      isSuperseded(current.studentSnapshotId, pinned.studentSnapshotId),
    ],
    [
      PlanStaleReason.AuditSuperseded,
      isSuperseded(current.auditSnapshotId, pinned.auditSnapshotId),
    ],
    [
      PlanStaleReason.SectionsSuperseded,
      sectionSnapshot.status === 'FOUND' && sectionSnapshot.value.id !== pinned.sectionSnapshotId,
    ],
    [PlanStaleReason.RulesetChanged, isSuperseded(current.rulesetVersion, pinned.rulesetVersion)],
    [
      PlanStaleReason.TransitionTableChanged,
      isSuperseded(current.campusTransitionVersion, pinned.campusTransitionVersion),
    ],
    [PlanStaleReason.SourceExpired, isExpired],
  ];
  return checks.filter(([, isProven]) => isProven).map(([reason]) => reason);
}

/**
 * Decides how current a saved revision is, from its pinned inputs and the current latest sources.
 *
 * `CURRENT` needs every comparison to succeed. A source that can't be read gives `UNKNOWN`
 * with `SOURCE_UNAVAILABLE`, plus any stale reason already proven. A pinned time exactly at the
 * maximum age is still fresh.
 *
 * @param pinned - The revision's pinned inputs.
 * @param current - The current latest sources.
 * @param policy - The clock reading and the maximum source age.
 * @returns The state, the reasons, and when the comparison was made.
 */
export function computePlanFreshness(
  pinned: PinnedRevisionInputs,
  current: CurrentSources,
  policy: FreshnessPolicy,
): PlanFreshnessView {
  const reasons = provenReasons(pinned, current, policy);
  const checkedAt = policy.now.toISOString();
  const readings = [
    current.studentSnapshotId,
    current.auditSnapshotId,
    current.sectionSnapshot,
    current.rulesetVersion,
    current.campusTransitionVersion,
  ];
  // SAFETY: an unreadable source is UNKNOWN, never CURRENT and never a guess (CLAUDE.md:
  // missing or conflicting data is UNKNOWN or a referral).
  if (readings.some((reading) => reading.status === 'UNAVAILABLE')) {
    return {
      state: PlanFreshness.Unknown,
      reasons: [...reasons, PlanStaleReason.SourceUnavailable],
      checkedAt,
    };
  }
  return {
    state: reasons.length > 0 ? PlanFreshness.Stale : PlanFreshness.Current,
    reasons,
    checkedAt,
  };
}
