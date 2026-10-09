/**
 * @file Loading state for the Plan detail page.
 * @module @caa/web/app/my-plans/[planId]/loading
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

/**
 * Tells the reader the page is loading and what will appear. The heading matches the page's, so
 * it doesn't change when the page arrives.
 *
 * @returns A status message.
 */
export default function PlanDetailLoading(): ReactElement {
  return (
    <div role="status">
      <h1>Plan detail</h1>
      <p>Loading this plan. Its details and checks will appear here when they are ready.</p>
    </div>
  );
}
