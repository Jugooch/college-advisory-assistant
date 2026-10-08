/**
 * @file A plan revision's freshness as text: the state label, why, and when it was checked.
 * @module @caa/web/shared/components/plan-freshness
 * @requirement FR-11
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ReactElement } from 'react';

import type { PlanFreshnessView } from '@caa/api-contract';

import { StatusBadge } from '@/components/ui/status-badge';
import { Timestamp } from '@/shared/components/timestamp';
import { describeFreshness, describeStaleReason } from '@/shared/utils/freshness-wording';

/** Props for {@link PlanFreshness}. */
export interface PlanFreshnessProps {
  readonly freshness: PlanFreshnessView;
}

/**
 * Renders the freshness exactly as the API returned it. The label carries the meaning, so
 * nothing depends on color.
 *
 * @param props - The freshness view.
 * @returns The freshness text.
 */
export function PlanFreshness({ freshness }: PlanFreshnessProps): ReactElement {
  const display = describeFreshness(freshness.state);
  return (
    <>
      <StatusBadge label={display.label} tone={display.tone} />
      <p>{display.explanation}</p>
      {display.nextStep === null ? null : <p>{display.nextStep}</p>}
      {freshness.reasons.length === 0 ? null : (
        <ul>
          {freshness.reasons.map((reason) => (
            <li key={reason}>{describeStaleReason(reason)}</li>
          ))}
        </ul>
      )}
      <p>
        Checked <Timestamp iso={freshness.checkedAt} />
      </p>
    </>
  );
}
