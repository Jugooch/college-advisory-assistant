/**
 * @file The plain-language message for one search outcome and what to do next.
 * @module @caa/web/shared/components/outcome-notice
 * @requirement FR-09
 * @requirement NFR-02
 */
import { type ReactElement, useId } from 'react';

import type { ScheduleOutcome } from '@caa/domain';

import { StatusBadge } from '@/components/ui/status-badge';
import { type HeadingLevel, headingTag } from '@/shared/utils/heading-level';
import { describeOutcome, INCOMPLETE_SEARCH_NOTICE } from '@/shared/utils/option-wording';

/** Props for {@link OutcomeNotice}. */
export interface OutcomeNoticeProps {
  readonly outcome: ScheduleOutcome;
  readonly searchComplete: boolean;
  /** Level of this card's heading; its sub-headings sit one level below. Defaults to `3`. */
  readonly headingLevel?: HeadingLevel;
}

/**
 * Renders the outcome's badge, message, and next step. When options were found by a search
 * that didn't finish, it also says others may exist.
 *
 * @param props - The outcome and whether the search finished.
 * @returns The notice section.
 */
export function OutcomeNotice({
  outcome,
  searchComplete,
  headingLevel = 3,
}: OutcomeNoticeProps): ReactElement {
  const headingId = useId();
  const Heading = headingTag(headingLevel);
  const wording = describeOutcome(outcome);
  const tone = wording.tone === 'negative' ? 'problem' : 'caution';
  return (
    <section className={`notice notice--${tone}`} aria-labelledby={headingId}>
      <Heading id={headingId}>{wording.heading}</Heading>
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
