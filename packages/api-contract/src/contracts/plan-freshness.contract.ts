/**
 * @file Freshness of a saved plan revision: whether its pinned inputs are still the latest.
 * @module @caa/api-contract/contracts/plan-freshness
 * @requirement FR-11
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

import {
  PlanFreshness,
  PlanFreshnessSchema,
  PlanStaleReason,
  PlanStaleReasonSchema,
} from '@caa/domain';

/**
 * Returns whether the freshness state and its reasons agree (ADR-0013 §3).
 *
 * @param freshness - The state and the reasons listed with it.
 * @returns `false` when a current revision lists a reason, a stale or unknown one lists none, an
 *   unknown one omits `SOURCE_UNAVAILABLE`, or a stale one claims it.
 */
function hasMatchingReasons(freshness: {
  readonly state: PlanFreshness;
  readonly reasons: readonly PlanStaleReason[];
}): boolean {
  const { state, reasons } = freshness;
  const hasUnavailable = reasons.includes(PlanStaleReason.SourceUnavailable);
  if (state === PlanFreshness.Current) {
    return reasons.length === 0;
  }
  return reasons.length > 0 && (state === PlanFreshness.Unknown) === hasUnavailable;
}

/**
 * Freshness of one revision, derived on the server when it is read, never stored. It describes
 * the revision "as of" `checkedAt`; it is not a claim about registration or eligibility.
 */
export const PlanFreshnessViewSchema = z
  .strictObject({
    state: PlanFreshnessSchema,
    /** Why the revision is not current; empty only when `state` is `CURRENT`. */
    reasons: z.array(PlanStaleReasonSchema).readonly(),
    /** When the server compared the pinned inputs. ISO 8601 with offset. */
    checkedAt: z.iso.datetime({ offset: true }),
  })
  // SAFETY: a revision whose sources couldn't be compared is never shown as current, and a
  // stale one always says why (ADR-0013 §3: UNKNOWN is never shown as CURRENT).
  .refine(hasMatchingReasons, {
    message:
      'CURRENT has no reasons; STALE and UNKNOWN have at least one; only UNKNOWN lists SOURCE_UNAVAILABLE',
    path: ['reasons'],
  })
  // SAFETY: a repeated reason would inflate what the student is told is wrong (ADR-0013 §3).
  .refine((freshness) => new Set(freshness.reasons).size === freshness.reasons.length, {
    message: 'reasons must not repeat a reason',
    path: ['reasons'],
  })
  .readonly();

/** Freshness of one revision. */
export type PlanFreshnessView = z.infer<typeof PlanFreshnessViewSchema>;
