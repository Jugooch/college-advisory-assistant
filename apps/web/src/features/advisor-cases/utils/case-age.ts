/**
 * @file How long a case has waited, in plain words, for the review queue's Age column.
 * @module @caa/web/features/advisor-cases/utils/case-age
 * @requirement FR-12
 * @requirement NFR-02
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Pluralizes a count of whole units.
 *
 * @param count - The number of units.
 * @param unit - The singular unit name.
 * @returns For example `1 day` or `3 days`.
 */
function plural(count: number, unit: string): string {
  return `${String(count)} ${unit}${count === 1 ? '' : 's'}`;
}

/**
 * Describes the time since a case was opened.
 *
 * @param createdAt - ISO 8601 with offset, as the API returns it.
 * @param now - The current time. The page passes it in so this stays pure.
 * @returns For example `Less than an hour`, `5 hours`, or `3 days`.
 */
export function describeCaseAge(createdAt: string, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - Date.parse(createdAt));
  if (elapsed < HOUR_MS) {
    return 'Less than an hour';
  }
  if (elapsed < DAY_MS) {
    return plural(Math.floor(elapsed / HOUR_MS), 'hour');
  }
  return plural(Math.floor(elapsed / DAY_MS), 'day');
}
