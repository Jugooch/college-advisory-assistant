/**
 * @file The review queue's body: the table, or an empty state that says why it is empty and what
 * to do next. Rows are shown exactly as the API returned them.
 * @module @caa/web/features/advisor-cases/components/case-queue
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { ReactElement } from 'react';

import type { CaseQueueResponse } from '@caa/api-contract';

import type { QueueFilter } from '../utils/queue-filter';
import { describeEmptyQueue } from '../utils/review-wording';
import { CaseQueueTable } from './case-queue-table';

/** Props for {@link CaseQueue}. */
export interface CaseQueueProps {
  readonly queue: CaseQueueResponse;
  readonly filter: QueueFilter;
  /** The current time, for each row's age. */
  readonly now: Date;
}

/**
 * Renders the queue or its empty state.
 *
 * @param props - The queue, the filter in use, and the current time.
 * @returns The table or the empty-state notice.
 */
export function CaseQueue({ queue, filter, now }: CaseQueueProps): ReactElement {
  if (queue.cases.length === 0) {
    const empty = describeEmptyQueue(filter);
    return (
      <section className="notice" aria-labelledby="queue-empty-heading">
        <h2 id="queue-empty-heading">{empty.heading}</h2>
        <p>{empty.explanation}</p>
        <p>{empty.nextStep}</p>
      </section>
    );
  }
  return <CaseQueueTable cases={queue.cases} now={now} />;
}
