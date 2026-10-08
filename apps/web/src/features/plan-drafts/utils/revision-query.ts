/**
 * @file Reads the `revision` query value that opens an earlier revision of a plan.
 * @module @caa/web/features/plan-drafts/utils/revision-query
 * @requirement FR-11
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */

/**
 * Reads an earlier revision number from a query value.
 *
 * @param value - The raw `revision` query value.
 * @param latest - The plan's latest revision number.
 * @returns The earlier revision to open, or `null` to show the latest: the value is missing,
 *   isn't a whole number from 1 to `latest`, or names the latest itself.
 */
export function readRevisionQuery(
  value: string | readonly string[] | undefined,
  latest: number,
): number | null {
  // SECURITY: only a plain digit string within 1..latest reaches the API path (standard 09).
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,8}$/.test(value)) {
    return null;
  }
  const revision = Number(value);
  return revision < latest ? revision : null;
}
