/**
 * @file Loading state for the Ask an advisor page.
 * @module @caa/web/app/ask-an-advisor/loading
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

/**
 * Tells the reader the page is loading and what will appear. The heading matches the page's, so
 * it doesn't change when the page arrives.
 *
 * @returns A status message.
 */
export default function AskAnAdvisorLoading(): ReactElement {
  return (
    <div role="status">
      <h1>Ask an advisor</h1>
      <p>Loading the advisor request page. The form will appear here when it is ready.</p>
    </div>
  );
}
