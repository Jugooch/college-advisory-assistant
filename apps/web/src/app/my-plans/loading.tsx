/**
 * @file Loading state for the My plans page.
 * @module @caa/web/app/my-plans/loading
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

/**
 * Tells the reader the page is loading and what will appear. The heading matches the page's, so
 * it doesn't change when the page arrives.
 *
 * @returns A status message.
 */
export default function MyPlansLoading(): ReactElement {
  return (
    <div role="status">
      <h1>My plans</h1>
      <p>Loading your saved plans. The list will appear here when it is ready.</p>
    </div>
  );
}
