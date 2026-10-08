/**
 * @file Fixed wording for a plan's freshness and its reasons. Freshness is shown exactly as the API
 * returned it, as text, and describes the draft "as of" a time. It never says a plan is
 * registered or approved.
 * @module @caa/web/shared/utils/freshness-wording
 * @requirement FR-11
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { PlanFreshness, PlanStaleReason } from '@caa/domain';

import type { StatusTone } from '@/components/ui/status-badge';

/** How one freshness state is shown. */
export interface FreshnessDisplay {
  readonly label: string;
  readonly tone: StatusTone;
  readonly explanation: string;
  /** What to do next; `null` when the draft is up to date. */
  readonly nextStep: string | null;
}

// SAFETY: UNKNOWN has its own wording and is never shown as up to date (ADR-0013 §3).
const FRESHNESS_WORDING: Readonly<Record<PlanFreshness, FreshnessDisplay>> = {
  CURRENT: {
    label: 'Up to date',
    tone: 'neutral',
    explanation:
      'The records this draft was built on are still the latest. This says nothing about seats or registration.',
    nextStep: null,
  },
  STALE: {
    label: 'Out of date',
    tone: 'caution',
    explanation:
      'Something this draft was built on has changed. Treat it as history, not as a current check.',
    nextStep:
      'Plan next term again to build a current draft, or ask your advisor to review this one.',
  },
  UNKNOWN: {
    label: 'Couldn’t check',
    tone: 'caution',
    explanation:
      'We couldn’t compare this draft with the latest records. Treat it as history, not as a current check.',
    nextStep: 'Try again later, or ask your advisor to review this draft.',
  },
};

// SAFETY: each reason has its own sentence, so the student sees exactly what the API reported.
const REASON_WORDING: Readonly<Record<PlanStaleReason, string>> = {
  STUDENT_RECORD_SUPERSEDED: 'Your course record changed after this draft was saved.',
  AUDIT_SUPERSEDED: 'Your degree audit has been updated since this draft was built.',
  SECTIONS_SUPERSEDED: 'The course sections have been updated since this draft was built.',
  RULESET_CHANGED: 'The advising rules have changed since this draft was built.',
  TRANSITION_TABLE_CHANGED: 'The campus travel-time data has changed since this draft was built.',
  SOURCE_EXPIRED: 'The data this draft used is older than allowed.',
  SOURCE_UNAVAILABLE: 'A source system couldn’t be reached, so the draft couldn’t be compared.',
};

/**
 * Describes a freshness state.
 *
 * @param state - The state from the API.
 * @returns Its label, tone, and explanation.
 */
export function describeFreshness(state: PlanFreshness): FreshnessDisplay {
  return FRESHNESS_WORDING[state];
}

/**
 * Describes why a revision is not current.
 *
 * @param reason - A reason from the API.
 * @returns One plain sentence.
 */
export function describeStaleReason(reason: PlanStaleReason): string {
  return REASON_WORDING[reason];
}
