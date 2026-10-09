/**
 * @file Loading state for the Plan next term page.
 * @module @caa/web/app/next-term-planner/loading
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

/**
 * Tells the reader the page is loading and what will appear. The heading matches the page's, so
 * it doesn't change when the page arrives.
 *
 * @returns A status message.
 */
export default function NextTermPlannerLoading(): ReactElement {
  return (
    <div role="status">
      <h1>Plan next term</h1>
      <p>
        Loading the planner. Your setup form and any schedule options will appear here when they are
        ready.
      </p>
    </div>
  );
}
