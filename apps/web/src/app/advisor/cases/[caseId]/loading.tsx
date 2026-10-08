/**
 * @file Loading state for the case review page.
 * @module @caa/web/app/advisor/cases/[caseId]/loading
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

/**
 * Tells the reader the case is loading and what will appear.
 *
 * @returns A status message.
 */
export default function ReviewCaseLoading(): ReactElement {
  return (
    <div role="status">
      <h1>Review a case</h1>
      <p>Loading the case. The student’s note and the attached plan will appear here.</p>
    </div>
  );
}
