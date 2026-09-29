/**
 * @file The seeded records' times and per-run revision IDs, derived from the one clock reading
 *   taken when a seed run starts. Pure given that reading.
 * @module @caa/db/seed/dev-seed-record-times
 * @requirement FR-01
 * @see docs/planning/07-system-architecture-and-design.md
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

// SAFETY: every gap between seeded times lives here, so the freshness and skew relationships
// the scenarios depend on are visible in one place:
// - the current record is 3 hours old, well within the API's 24-hour dev maximum source age;
// - the current audit ran against exactly that record time (0 ms apart), so it reflects the
//   record under any non-negative skew;
// - the stale student's audit ran against a record 17 days older than the latest one, beyond the
//   API's largest allowed skew (7 days) and its maximum source age.
/** Offsets, in milliseconds, between the seed run and the seeded times. */
export const SEED_TIME_OFFSETS_MS = {
  /** How long before the run the current record takes effect. */
  currentRecordAge: 3 * HOUR_MS,
  /** How long after a record takes effect it is ingested. */
  ingestionLag: HOUR_MS,
  /** How long after a record takes effect its audit is generated. */
  auditLag: 2 * HOUR_MS,
  /** How much older the stale audit's record is than the latest record. */
  staleAuditGap: 17 * DAY_MS,
} as const;

/** Source, ingestion, and audit times of one seed run's records. ISO 8601 with offset. */
export interface SeedRecordTimes {
  readonly currentRecordEffectiveAt: string;
  readonly currentRecordIngestedAt: string;
  readonly currentAuditGeneratedAt: string;
  readonly staleRecordEffectiveAt: string;
  readonly staleRecordIngestedAt: string;
  readonly staleAuditGeneratedAt: string;
}

/** Largest instant that fits the 12-hex-digit final group of a revision ID. */
const MAX_SEED_INSTANT_MS = 0xffff_ffff_ffff;

/**
 * Reads a seed run's clock reading as epoch milliseconds.
 *
 * @param now - The time the run started.
 * @returns Milliseconds since the epoch.
 * @throws {RangeError} When `now` is invalid or outside the range a revision ID can encode.
 */
export function seedInstantMs(now: Date): number {
  const ms = now.getTime();
  if (!Number.isInteger(ms) || ms < 0 || ms > MAX_SEED_INSTANT_MS) {
    throw new RangeError('The seed run time must be a valid date after 1970');
  }
  return ms;
}

/**
 * Derives every seeded time from the run's clock reading. Each record is ingested after it takes
 * effect, and each audit is generated after the record it ran against.
 *
 * @param now - The time the seed run started.
 * @returns The times, all before `now`.
 * @throws {RangeError} When `now` is invalid.
 */
export function seedRecordTimes(now: Date): SeedRecordTimes {
  const offsets = SEED_TIME_OFFSETS_MS;
  const current = seedInstantMs(now) - offsets.currentRecordAge;
  const stale = current - offsets.staleAuditGap;
  const iso = (ms: number): string => new Date(ms).toISOString();
  return {
    currentRecordEffectiveAt: iso(current),
    currentRecordIngestedAt: iso(current + offsets.ingestionLag),
    currentAuditGeneratedAt: iso(current + offsets.auditLag),
    staleRecordEffectiveAt: iso(stale),
    staleRecordIngestedAt: iso(stale + offsets.ingestionLag),
    staleAuditGeneratedAt: iso(stale + offsets.auditLag),
  };
}

/**
 * Builds the ID of a revision one seed run adds: the kind prefix, a slot that tells the run's
 * revisions of one kind apart, and the run time. The same run time always gives the same ID, so
 * re-running with one clock reading writes nothing new.
 *
 * @param prefix - First UUID group, which names the record kind.
 * @param slot - Number of the revision within the run, 1 to 65535.
 * @param now - The time the seed run started.
 * @returns A version-4-shaped UUID.
 * @throws {RangeError} When `now` is invalid.
 */
export function seedRevisionId(prefix: string, slot: number, now: Date): string {
  const slotHex = slot.toString(16).padStart(4, '0');
  const timeHex = seedInstantMs(now).toString(16).padStart(12, '0');
  return `${prefix}-${slotHex}-4000-8000-${timeHex}`;
}
