/**
 * @file Wording for requirement states and audit freshness, taken as the API returns them.
 * @module @caa/web/features/academic-summary/utils/requirement-state-wording
 * @requirement FR-04
 * @requirement FR-05
 * @requirement NFR-02
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import type { AcademicSummaryResponse } from '@caa/api-contract';
import { CheckState, type RequirementState } from '@caa/domain';

import type { StatusTone } from '@/components/ui/status-badge';
import { formatTimestamp } from '@/shared/utils/format-display';

/** How one requirement's state is shown. */
export interface RequirementStateDisplay {
  readonly label: string;
  readonly tone: StatusTone;
  /** What the state means, or null when the label says enough. */
  readonly explanation: string | null;
}

/** The audit's own word for each requirement state. */
const STATE_WORDS: Readonly<Record<RequirementState, string>> = {
  COMPLETE: 'complete',
  IN_PROGRESS: 'in progress',
  INCOMPLETE: 'not complete',
  AMBIGUOUS: 'not settled',
};

/**
 * Returns whether the summary's requirement states must be shown as needing verification rather
 * than as current standing. Reads the API's two verdicts; it never re-derives them.
 *
 * @param summary - The academic summary as returned.
 * @returns `true` when either `auditReflectsRecord` or `programCatalogConsistency` is UNKNOWN.
 */
export function isStandingUnverified(
  summary: Pick<AcademicSummaryResponse, 'auditReflectsRecord' | 'programCatalogConsistency'>,
): boolean {
  // SAFETY: under AUDIT_STALE, AUDIT_AMBIGUOUS, or AUDIT_PROGRAM_MISMATCH the audit may not
  // describe this record or program, so its states are never shown as current (contract TSDoc).
  return (
    summary.auditReflectsRecord?.state === CheckState.Unknown ||
    summary.programCatalogConsistency?.state === CheckState.Unknown
  );
}

/**
 * Describes one requirement's state with the time it describes.
 *
 * @param state - The requirement state from the audit.
 * @param context - `auditGeneratedAt`, and whether the states need verification.
 * @returns The badge label, tone, and explanation.
 */
export function describeRequirementState(
  state: RequirementState,
  context: { readonly auditGeneratedAt: string; readonly isUnverified: boolean },
): RequirementStateDisplay {
  const asOf = formatTimestamp(context.auditGeneratedAt);
  if (context.isUnverified) {
    return {
      label: `Needs verification: audit showed ${STATE_WORDS[state]} as of ${asOf}`,
      tone: 'caution',
      explanation: 'This is not your current standing. See the audit notice above.',
    };
  }
  switch (state) {
    case 'COMPLETE':
      return { label: `Complete as of ${asOf}`, tone: 'positive', explanation: null };
    case 'IN_PROGRESS':
      return {
        label: `In progress as of ${asOf}`,
        tone: 'caution',
        explanation: 'Complete only if your current courses finish with the required grades.',
      };
    case 'INCOMPLETE':
      return { label: `Not complete as of ${asOf}`, tone: 'neutral', explanation: null };
    case 'AMBIGUOUS':
      return {
        label: `Needs verification as of ${asOf}`,
        tone: 'caution',
        explanation: 'The audit doesn’t settle this requirement. Ask your advisor to confirm it.',
      };
  }
}
