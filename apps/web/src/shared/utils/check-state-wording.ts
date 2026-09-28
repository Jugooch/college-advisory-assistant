/**
 * @file Wording for check states and the aggregate, as the API returns them. Never recomputed.
 * @module @caa/web/shared/utils/check-state-wording
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import type { AggregateState, CheckState } from '@caa/domain';

import type { StatusTone } from '@/components/ui/status-badge';

/** How a state is shown: a badge label and tone. */
export interface StateDisplay {
  readonly label: string;
  readonly tone: StatusTone;
}

/** How the aggregate is shown: a badge, and what it does and doesn't mean. */
export interface AggregateDisplay extends StateDisplay {
  readonly explanation: string;
}

/**
 * Describes one check state.
 *
 * @param state - The check state from the API.
 * @param asOf - The as-of text a PASS holds for, for example
 *   `Sep 12, 2026, 2:00 PM UTC (record) and Sep 10, 2026, 9:00 AM UTC (audit)`.
 * @returns The badge label and tone.
 */
export function describeCheckState(state: CheckState, asOf: string): StateDisplay {
  // SAFETY: PASS is only "passed as of" its inputs, UNKNOWN is never neutral or passing, and
  // CONDITIONAL is never unconditional (planning/08 §Authority and result semantics).
  switch (state) {
    case 'PASS':
      return { label: `Passed as of ${asOf}`, tone: 'positive' };
    case 'FAIL':
      return { label: 'Not met', tone: 'negative' };
    case 'UNKNOWN':
      return { label: 'Needs verification', tone: 'caution' };
    case 'CONDITIONAL':
      return { label: 'Conditional', tone: 'caution' };
  }
}

/**
 * Describes the aggregate of a course set.
 *
 * @param aggregate - The aggregate state from the API.
 * @returns The badge label, tone, and explanation.
 */
export function describeAggregate(aggregate: AggregateState): AggregateDisplay {
  // SAFETY: no single green approval: VALIDATED covers only the listed checks, and is neutral.
  switch (aggregate) {
    case 'BLOCKED':
      return {
        label: 'Blocked',
        tone: 'negative',
        explanation: 'At least one check below is not met.',
      };
    case 'NEEDS_VERIFICATION':
      return {
        label: 'Needs verification',
        tone: 'caution',
        explanation: 'At least one check below couldn’t be decided and needs verification.',
      };
    case 'CONDITIONAL':
      return {
        label: 'Conditional',
        tone: 'caution',
        explanation: 'The checks below hold only if the conditions they list are met.',
      };
    case 'VALIDATED':
      return {
        label: 'Validated for the listed checks only',
        tone: 'neutral',
        explanation: 'Every check below passed. Nothing else was checked.',
      };
  }
}
