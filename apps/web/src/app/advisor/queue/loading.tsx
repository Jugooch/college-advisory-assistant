/**
 * @file Loading state for the review queue.
 * @module @caa/web/app/advisor/queue/loading
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

/**
 * Tells the reader the queue is loading and what will appear.
 *
 * @returns A status message.
 */
export default function ReviewQueueLoading(): ReactElement {
  return (
    <div role="status">
      <h1>Review queue</h1>
      <p>Loading the cases to review. The list will appear here when it is ready.</p>
    </div>
  );
}
