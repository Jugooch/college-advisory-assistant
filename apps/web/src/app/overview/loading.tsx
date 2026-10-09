/**
 * @file Loading state for the Overview page.
 * @module @caa/web/app/overview/loading
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

/**
 * Tells the reader the page is loading and what will appear. The heading matches the page's, so
 * it doesn't change when the page arrives.
 *
 * @returns A status message.
 */
export default function OverviewLoading(): ReactElement {
  return (
    <div role="status">
      <h1>Overview</h1>
      <p>
        Loading your overview. Your record summary and next steps will appear here when they are
        ready.
      </p>
    </div>
  );
}
