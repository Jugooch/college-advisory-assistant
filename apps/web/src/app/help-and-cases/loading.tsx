/**
 * @file Loading state for the Help and cases page.
 * @module @caa/web/app/help-and-cases/loading
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

/**
 * Tells the reader the page is loading and what will appear. The heading matches the page's, so
 * it doesn't change when the page arrives.
 *
 * @returns A status message.
 */
export default function HelpAndCasesLoading(): ReactElement {
  return (
    <div role="status">
      <h1>Help and cases</h1>
      <p>Loading help and your cases. They will appear here when they are ready.</p>
    </div>
  );
}
