/**
 * @file Decides whether a source time is fresh enough for a validated result. Pure logic
 * (standard 05 §Logic): the caller reads the clock and passes the time in.
 * @module @caa/api/modules/source-freshness/source-freshness.logic
 * @requirement FR-04
 * @requirement NFR-01
 * @see docs/planning/09-data-model-and-integration-contracts.md
 * @see docs/adr/0008-api-logic-role-and-source-freshness.md
 */

/**
 * Most a source time may be ahead of the clock and still count as fresh: five minutes, for clock
 * drift between the source system and this server. Anything further ahead is not fresh.
 */
export const SOURCE_TIME_FUTURE_TOLERANCE_MS = 300_000;

/** The clock reading and the configured maximum age a freshness decision uses. */
export interface FreshnessPolicy {
  /** The injected clock's current time; read by the caller, never by the engine. */
  readonly now: Date;
  /** Validated `ACADEMIC_SOURCE_MAX_AGE_MS`. */
  readonly maxAgeMs: number;
}

/**
 * Decides whether a source time is fresh enough for a validated result.
 *
 * @param sourceTime - The time the source data describes, ISO 8601 with offset; may be missing.
 * @param policy - The current time and the maximum age.
 * @returns `true` when the time is at most `maxAgeMs` old (exactly at the limit is fresh) and
 *   no more than the tolerance in the future; `false` when it is missing or unparseable.
 */
export function isSourceFresh(
  sourceTime: string | null | undefined,
  policy: FreshnessPolicy,
): boolean {
  const instant = typeof sourceTime === 'string' ? Date.parse(sourceTime) : Number.NaN;
  // SAFETY: a missing or unreadable time can't show the data is recent, and a time far in the
  // future is a source error; neither is treated as fresh (planning/09 §Proposed freshness
  // policies; planning/08: missing or conflicting data is UNKNOWN or a referral).
  if (Number.isNaN(instant)) {
    return false;
  }
  const ageMs = policy.now.getTime() - instant;
  return ageMs <= policy.maxAgeMs && ageMs >= -SOURCE_TIME_FUTURE_TOLERANCE_MS;
}
