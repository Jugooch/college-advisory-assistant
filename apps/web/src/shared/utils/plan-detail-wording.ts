/**
 * @file Fixed wording for the plan detail screen: the freshness banner, the plan-vs-registration
 * boundary, revision causes, and the unreadable-result message. Freshness is shown exactly as the
 * API returned it, as text, and always as history "as of" a time. It never says a plan is
 * registered, enrolled, or approved, and never claims a current validation.
 * @module @caa/web/shared/utils/plan-detail-wording
 * @requirement FR-11
 * @requirement NFR-02
 * @requirement NFR-05
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { PlanFreshness, PlanRevisionCause } from '@caa/domain';

/** How one freshness state is announced as the banner on the detail screen. */
export interface FreshnessBanner {
  readonly heading: string;
  readonly explanation: string;
  readonly nextStep: string;
}

// SAFETY: UNKNOWN has its own heading and is never shown as up to date (ADR-0013 §3), and a
// stale or unknown draft says its checks are history, not a current result (AC14, AC16).
const BANNER_WORDING: Readonly<Record<PlanFreshness, FreshnessBanner>> = {
  CURRENT: {
    heading: 'This draft is up to date',
    explanation:
      'The records this draft was built on were still the latest when we last checked. This says nothing about seats or registration.',
    nextStep: 'You can revalidate at any time to check again.',
  },
  STALE: {
    heading: 'This draft is out of date',
    explanation:
      'Something this draft was built on has changed. The checks below are history from when it was saved, not a current result.',
    nextStep:
      'Revalidate to build a new revision from your latest records, or ask an advisor to review this draft.',
  },
  UNKNOWN: {
    heading: 'We couldn’t check whether this draft is still current',
    explanation:
      'The checks below are history from when it was saved, not a current result. They may or may not still hold.',
    nextStep:
      'Try revalidating later, or ask an advisor to review this draft. An advisor can look at it even when our checks can’t.',
  },
};

/** States the plan-vs-registration boundary (AC16, R11). */
export const PLAN_BOUNDARY_NOTE =
  'A draft is a saved plan. It isn’t a registration, and it doesn’t change your record or hold a seat.';

/** Label for a revision that is not the latest. */
export const EARLIER_REVISION_LABEL = 'Earlier revision';

/** Explains an earlier revision: read-only history. */
export const EARLIER_REVISION_NOTE =
  'This is a read-only earlier revision. A newer revision exists, and this one is shown as it was saved.';

/** Shown when the saved result no longer parses; nothing from it is shown (ADR-0013 §2). */
export const RESULT_UNAVAILABLE_DETAIL =
  'This saved result can’t be displayed. Nothing from it is shown. You can revalidate to build a new revision, or ask an advisor.';

/** Shown when the plan itself can't be found for this student. */
export const PLAN_NOT_FOUND_MESSAGE = 'We couldn’t find that plan.';

/**
 * Describes a freshness state for the detail banner.
 *
 * @param state - The state from the API.
 * @returns Its heading, explanation, and next step.
 */
export function describeFreshnessBanner(state: PlanFreshness): FreshnessBanner {
  return BANNER_WORDING[state];
}

// SAFETY: the cause is only a history label; it claims nothing about the revision's validity.
const CAUSE_WORDING: Readonly<Record<PlanRevisionCause, string>> = {
  SAVED: 'Saved',
  REVALIDATED: 'Revalidation',
};

/**
 * Names why a revision was added.
 *
 * @param cause - The cause from the API.
 * @returns A short label.
 */
export function describeRevisionCause(cause: PlanRevisionCause): string {
  return CAUSE_WORDING[cause];
}
