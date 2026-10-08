/**
 * @file The saved result on the plan detail: the result as history "as of" its time, or the
 * message that it can't be displayed. Nothing from an unreadable result is shown.
 * @module @caa/web/shared/components/result-section
 * @requirement FR-11
 * @requirement NFR-02
 * @requirement NFR-05
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ReactElement, ReactNode } from 'react';

import type { PlanRevisionView, ScheduleOptionsResponse } from '@caa/api-contract';

import { formatTimestamp } from '@/shared/utils/format-display';
import { RESULT_UNAVAILABLE_DETAIL } from '@/shared/utils/plan-detail-wording';

/** Props for {@link ResultSection}. */
export interface ResultSectionProps {
  readonly revision: PlanRevisionView;
  /** Whether the revision is shown as history: an earlier one, or one that isn't current. */
  readonly isHistory: boolean;
  /** Renders the result under the given heading, without moving focus; the page supplies it. */
  readonly renderResult: (result: ScheduleOptionsResponse, heading: string) => ReactNode;
}

/**
 * Renders the saved result, or the unreadable-result message.
 *
 * @param props - The revision, whether it is history, and the result renderer.
 * @returns The result section.
 */
export function ResultSection({
  revision,
  isHistory,
  renderResult,
}: ResultSectionProps): ReactElement {
  if (revision.result === null) {
    return (
      <section aria-labelledby="result-unavailable-heading">
        <h2 id="result-unavailable-heading">Saved result</h2>
        <p>{RESULT_UNAVAILABLE_DETAIL}</p>
      </section>
    );
  }
  return (
    <>
      {isHistory ? (
        <p>
          These checks describe the draft as it was saved. They are history, not a current check.
        </p>
      ) : null}
      {renderResult(revision.result, `Saved result, as of ${formatTimestamp(revision.createdAt)}`)}
    </>
  );
}
