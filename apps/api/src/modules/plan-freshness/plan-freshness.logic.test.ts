/**
 * @file Tests for the plan freshness rule: CURRENT, each stale reason, the exact-age boundary,
 * and UNKNOWN when a source can't be read (never CURRENT).
 * @requirement FR-11
 * @requirement NFR-05
 */
import { describe, expect, it } from 'vitest';

import { PlanFreshnessViewSchema } from '@caa/api-contract';
import { PlanFreshness, PlanStaleReason } from '@caa/domain';
import { buildPlanRevision } from '@caa/test-kit';

import {
  computePlanFreshness,
  type CurrentSources,
  type SourceReading,
} from './plan-freshness.logic';

const MAX_AGE_MS = 86_400_000;
const AT = '2026-09-01T00:00:00.000Z';
const NOW = new Date(Date.parse(AT) + MAX_AGE_MS);
const policy = { now: NOW, maxAgeMs: MAX_AGE_MS };

const pinned = buildPlanRevision({
  studentRecordEffectiveAt: AT,
  auditRecordEffectiveAt: AT,
  campusTransitionVersion: 'transitions_r1',
});

/**
 * Wraps a value as a found reading.
 *
 * @param value - The current value.
 * @returns The reading.
 */
function found<T>(value: T): SourceReading<T> {
  return { status: 'FOUND', value };
}

const UNAVAILABLE = { status: 'UNAVAILABLE' } as const;

/** Sources that all still equal the revision's pins. */
const currentSources: CurrentSources = {
  studentSnapshotId: found(pinned.studentSnapshotId),
  auditSnapshotId: found(pinned.auditSnapshotId),
  sectionSnapshot: found({ id: pinned.sectionSnapshotId, sourceEffectiveAt: AT }),
  rulesetVersion: found(pinned.rulesetVersion),
  campusTransitionVersion: found(pinned.campusTransitionVersion),
};

describe('computePlanFreshness', () => {
  it('is CURRENT with no reasons when every pin is still the latest and exactly at max age', () => {
    const result = computePlanFreshness(pinned, currentSources, policy);

    expect(result).toEqual({
      state: PlanFreshness.Current,
      reasons: [],
      checkedAt: NOW.toISOString(),
    });
  });

  it('is STALE with SOURCE_EXPIRED one millisecond past the max age', () => {
    const later = { now: new Date(NOW.getTime() + 1), maxAgeMs: MAX_AGE_MS };

    expect(computePlanFreshness(pinned, currentSources, later)).toMatchObject({
      state: PlanFreshness.Stale,
      reasons: [PlanStaleReason.SourceExpired],
    });
  });

  it.each([
    ['studentRecordEffectiveAt', { studentRecordEffectiveAt: '2026-08-30T00:00:00.000Z' }],
    ['auditRecordEffectiveAt', { auditRecordEffectiveAt: '2026-08-30T00:00:00.000Z' }],
  ])('is STALE with SOURCE_EXPIRED when the pinned %s is past the age', (_field, override) => {
    const old = buildPlanRevision({ ...pinned, ...override });

    expect(computePlanFreshness(old, currentSources, policy)).toMatchObject({
      state: PlanFreshness.Stale,
      reasons: [PlanStaleReason.SourceExpired],
    });
  });

  it('is STALE with SOURCE_EXPIRED when the pinned section snapshot is past the age', () => {
    const sources = {
      ...currentSources,
      sectionSnapshot: found({
        id: pinned.sectionSnapshotId,
        sourceEffectiveAt: '2026-08-30T00:00:00.000Z',
      }),
    };

    expect(computePlanFreshness(pinned, sources, policy).reasons).toEqual([
      PlanStaleReason.SourceExpired,
    ]);
  });

  it.each([
    [PlanStaleReason.StudentRecordSuperseded, { studentSnapshotId: found('another-record') }],
    [PlanStaleReason.AuditSuperseded, { auditSnapshotId: found('another-audit') }],
    [
      PlanStaleReason.SectionsSuperseded,
      { sectionSnapshot: found({ id: 'another-sections', sourceEffectiveAt: AT }) },
    ],
    [PlanStaleReason.RulesetChanged, { rulesetVersion: found('ruleset_demo_r2') }],
    [PlanStaleReason.TransitionTableChanged, { campusTransitionVersion: found('transitions_r2') }],
    [PlanStaleReason.TransitionTableChanged, { campusTransitionVersion: found(null) }],
  ])('is STALE with %s when that pin was superseded', (reason, override) => {
    const result = computePlanFreshness(pinned, { ...currentSources, ...override }, policy);

    expect(result).toMatchObject({ state: PlanFreshness.Stale, reasons: [reason] });
  });

  it('treats a transition table that appeared after a null pin as changed', () => {
    const noTable = buildPlanRevision({ ...pinned, campusTransitionVersion: null });
    const sources = { ...currentSources, campusTransitionVersion: found('transitions_r1') };

    expect(computePlanFreshness(noTable, sources, policy).reasons).toEqual([
      PlanStaleReason.TransitionTableChanged,
    ]);
  });

  it('lists every proven reason once, in a fixed order', () => {
    const sources: CurrentSources = {
      studentSnapshotId: found('a'),
      auditSnapshotId: found('b'),
      sectionSnapshot: found({ id: 'c', sourceEffectiveAt: AT }),
      rulesetVersion: found('d'),
      campusTransitionVersion: found('e'),
    };
    const later = { now: new Date(NOW.getTime() + 1), maxAgeMs: MAX_AGE_MS };

    const result = computePlanFreshness(pinned, sources, later);

    expect(result.reasons).toEqual([
      PlanStaleReason.StudentRecordSuperseded,
      PlanStaleReason.AuditSuperseded,
      PlanStaleReason.SectionsSuperseded,
      PlanStaleReason.RulesetChanged,
      PlanStaleReason.TransitionTableChanged,
      PlanStaleReason.SourceExpired,
    ]);
    expect(PlanFreshnessViewSchema.safeParse(result).success).toBe(true);
  });

  it.each([
    ['student record', { studentSnapshotId: UNAVAILABLE }],
    ['audit', { auditSnapshotId: UNAVAILABLE }],
    ['section snapshot', { sectionSnapshot: UNAVAILABLE }],
    ['ruleset', { rulesetVersion: UNAVAILABLE }],
    ['transition table', { campusTransitionVersion: UNAVAILABLE }],
  ])('is UNKNOWN with SOURCE_UNAVAILABLE when the %s cannot be read', (_source, override) => {
    const result = computePlanFreshness(pinned, { ...currentSources, ...override }, policy);

    expect(result).toMatchObject({
      state: PlanFreshness.Unknown,
      reasons: [PlanStaleReason.SourceUnavailable],
    });
    expect(PlanFreshnessViewSchema.safeParse(result).success).toBe(true);
  });

  it('is UNKNOWN but still lists a stale reason that is already proven', () => {
    const sources = {
      ...currentSources,
      studentSnapshotId: found('another-record'),
      auditSnapshotId: UNAVAILABLE,
    };

    expect(computePlanFreshness(pinned, sources, policy)).toMatchObject({
      state: PlanFreshness.Unknown,
      reasons: [PlanStaleReason.StudentRecordSuperseded, PlanStaleReason.SourceUnavailable],
    });
  });

  it('proves expiry from the pinned times even when every current source is unreadable', () => {
    const old = buildPlanRevision({
      ...pinned,
      studentRecordEffectiveAt: '2026-08-30T00:00:00.000Z',
    });
    const sources: CurrentSources = {
      studentSnapshotId: UNAVAILABLE,
      auditSnapshotId: UNAVAILABLE,
      sectionSnapshot: UNAVAILABLE,
      rulesetVersion: UNAVAILABLE,
      campusTransitionVersion: UNAVAILABLE,
    };

    expect(computePlanFreshness(old, sources, policy)).toMatchObject({
      state: PlanFreshness.Unknown,
      reasons: [PlanStaleReason.SourceExpired, PlanStaleReason.SourceUnavailable],
    });
  });
});
