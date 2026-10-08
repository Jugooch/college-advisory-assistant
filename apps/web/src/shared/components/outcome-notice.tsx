/**
 * @file The plain-language message for one search outcome and what to do next.
 * @module @caa/web/shared/components/outcome-notice
 * @requirement FR-09
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import type { ScheduleOutcome } from '@caa/domain';

import { StatusBadge } from '@/components/ui/status-badge';
import { describeOutcome, INCOMPLETE_SEARCH_NOTICE } from '@/shared/utils/option-wording';

/** Props for {@link OutcomeNotice}. */
export interface OutcomeNoticeProps {
  readonly outcome: ScheduleOutcome;
  readonly searchComplete: boolean;
}

/**
 * Renders the outcome's badge, message, and next step. When options were found by a search
 * that didn't finish, it also says others may exist.
 *
 * @param props - The outcome and whether the search finished.
 * @returns The notice section.
 */
export function OutcomeNotice({ outcome, searchComplete }: OutcomeNoticeProps): ReactElement {
  const wording = describeOutcome(outcome);
  const tone = wording.tone === 'negative' ? 'problem' : 'caution';
  return (
    <section className={`notice notice--${tone}`} aria-labelledby="outcome-heading">
      <h3 id="outcome-heading">{wording.heading}</h3>
      <p>
        <StatusBadge label={wording.label} tone={wording.tone} />
      </p>
      <p>{wording.message}</p>
      {outcome === 'OPTIONS_FOUND' && !searchComplete ? <p>{INCOMPLETE_SEARCH_NOTICE}</p> : null}
      <p>
        <strong>Next step:</strong> {wording.nextStep}
      </p>
    </section>
  );
}
