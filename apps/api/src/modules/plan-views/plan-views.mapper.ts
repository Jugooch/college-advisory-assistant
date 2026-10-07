/**
 * @file Turns stored plan revisions into the response views. A stored result that no longer
 * parses is withheld, never repaired or partly shown (ADR-0013 §2).
 * @module @caa/api/modules/plan-views/plan-views.mapper
 * @requirement FR-02
 * @requirement NFR-05
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import {
  type PlanFreshnessView,
  type PlanRevisionView,
  PlanRevisionViewSchema,
  ScheduleOptionsResponseSchema,
} from '@caa/api-contract';
import type { StoredPlanRevision } from '@caa/db';

import type { RequestContext } from '../../shared/request-context';

/**
 * Validates view fields against the contract, withholding the saver's user ID first.
 *
 * @param revision - The stored revision.
 * @param view - The result, its flag, and the freshness.
 * @returns The validated view, or null when the fields break the contract.
 */
function parseView(
  revision: StoredPlanRevision['revision'],
  view: Pick<PlanRevisionView, 'result' | 'resultUnavailable' | 'freshness'>,
): PlanRevisionView | null {
  // SECURITY: a view shows no user ID (ADR-0013 §6), so the saver is dropped before parsing.
  const publicFields = Object.fromEntries(
    Object.entries(revision).filter(([key]) => key !== 'createdBy'),
  );
  const parsed = PlanRevisionViewSchema.safeParse({ ...publicFields, ...view });
  return parsed.success ? parsed.data : null;
}

/**
 * Builds the revision view from a stored revision and its derived freshness.
 *
 * The stored result is parsed with the current contract. If it no longer parses, or no longer
 * agrees with the revision's stored fields, the view carries `result: null` and
 * `resultUnavailable: true`, and the log line names IDs only.
 *
 * @param stored - The stored revision and its opaque result.
 * @param freshness - The freshness derived at read time.
 * @param context - Request-scoped values.
 * @returns The revision view; the historical revision is always returned.
 */
export function toRevisionView(
  stored: StoredPlanRevision,
  freshness: PlanFreshnessView,
  context: RequestContext,
): PlanRevisionView {
  const { revision } = stored;
  const parsedResult = ScheduleOptionsResponseSchema.safeParse(stored.result);
  if (parsedResult.success) {
    const candidate = parseView(revision, {
      result: parsedResult.data,
      resultUnavailable: false,
      freshness,
    });
    if (candidate !== null) {
      return candidate;
    }
  }
  // SAFETY: an unreadable result is flagged and withheld, so the UI can't show it as a pass.
  context.logger.warn(
    { planId: revision.planId, planRevisionId: revision.id, revision: revision.revision },
    'stored plan result unreadable',
  );
  const withheld = parseView(revision, { result: null, resultUnavailable: true, freshness });
  if (withheld === null) {
    throw new Error('Stored plan revision breaks the revision view contract');
  }
  return withheld;
}
