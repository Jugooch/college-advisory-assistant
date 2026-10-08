/**
 * @file Fixed wording for a plan's open advisor case. A case is a request for review, so the
 * wording says only where it stands and never says a plan is registered or approved.
 * @module @caa/web/features/plan-drafts/utils/plan-wording
 * @requirement FR-11
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */

/** Open advisor case statuses a plan list can carry. */
export type OpenCaseStatus = 'OPEN' | 'IN_REVIEW';

// SAFETY: a case is a request for review, not an approval; the wording says only where it stands.
const CASE_WORDING: Readonly<Record<OpenCaseStatus, string>> = {
  OPEN: 'Open case, waiting for an advisor',
  IN_REVIEW: 'Open case, an advisor is reviewing it',
};

/** Shown when a plan has no open case. */
export const NO_OPEN_CASE = 'No open case';

/**
 * Describes a plan's open case.
 *
 * @param status - The open case status, or `null` when the plan has none.
 * @returns A plain phrase.
 */
export function describeOpenCase(status: OpenCaseStatus | null): string {
  return status === null ? NO_OPEN_CASE : CASE_WORDING[status];
}
