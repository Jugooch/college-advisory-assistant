/**
 * @file Builds synthetic plan freshness markers in the #403 contract shape, one per state.
 * @module @caa/test-kit/builders/plan-freshness-view
 */
import { type PlanFreshnessView, PlanFreshnessViewSchema } from '@caa/api-contract';
import { PlanFreshness, PlanStaleReason } from '@caa/domain';

/** Raw input accepted for a freshness marker, as the contract schema reads it. */
export type PlanFreshnessViewInput = Partial<PlanFreshnessView>;

/**
 * Builds a `CURRENT` freshness marker with no reasons, checked 2026-09-22 09:00 (-05:00).
 *
 * @param overrides - Fields to replace in the default.
 * @returns The marker, parsed by the contract.
 */
export function buildPlanFreshnessView(overrides: PlanFreshnessViewInput = {}): PlanFreshnessView {
  return PlanFreshnessViewSchema.parse({
    state: PlanFreshness.Current,
    reasons: [],
    checkedAt: '2026-09-22T09:00:00.000-05:00',
    ...overrides,
  });
}

/**
 * Builds a `STALE` marker; by default one reason, a newer section snapshot.
 *
 * @param overrides - Fields to replace in the default.
 * @returns The marker, parsed by the contract.
 */
export function buildStalePlanFreshnessView(
  overrides: PlanFreshnessViewInput = {},
): PlanFreshnessView {
  return buildPlanFreshnessView({
    state: PlanFreshness.Stale,
    reasons: [PlanStaleReason.SectionsSuperseded],
    ...overrides,
  });
}

/**
 * Builds an `UNKNOWN` marker whose reason is `SOURCE_UNAVAILABLE`: a source could not be read.
 *
 * @param overrides - Fields to replace in the default.
 * @returns The marker, parsed by the contract.
 */
export function buildUnknownPlanFreshnessView(
  overrides: PlanFreshnessViewInput = {},
): PlanFreshnessView {
  return buildPlanFreshnessView({
    state: PlanFreshness.Unknown,
    reasons: [PlanStaleReason.SourceUnavailable],
    ...overrides,
  });
}
