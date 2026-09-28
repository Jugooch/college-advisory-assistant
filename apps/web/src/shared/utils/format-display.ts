/**
 * @file Display formatting for timestamps and credit amounts. Formatting only; no decisions.
 * @module @caa/web/shared/utils/format-display
 */

/** Timestamps render in UTC, labelled, so every reader sees the same time. */
const TIMESTAMP_FORMAT = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

/**
 * Formats an ISO 8601 timestamp for display.
 *
 * @param iso - ISO 8601 timestamp with offset, as the API returns it.
 * @returns For example `Sep 12, 2026, 2:00 PM UTC`.
 */
export function formatTimestamp(iso: string): string {
  return `${TIMESTAMP_FORMAT.format(new Date(iso))} UTC`;
}

/**
 * Formats a credit amount given in hundredths, with integer arithmetic so no rounding occurs.
 *
 * @param hundredths - Non-negative credits in hundredths (350 = 3.5).
 * @returns For example `3`, `3.5`, or `0.25`.
 */
export function formatCredits(hundredths: number): string {
  const whole = Math.trunc(hundredths / 100);
  const fraction = String(hundredths % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  return fraction === '' ? String(whole) : `${String(whole)}.${fraction}`;
}
