/**
 * @file Loading state for the Course checks page.
 * @module @caa/web/app/course-checks/loading
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

/**
 * Tells the reader the page is loading and what will appear. The heading matches the page's, so
 * it doesn't change when the page arrives.
 *
 * @returns A status message.
 */
export default function CourseChecksLoading(): ReactElement {
  return (
    <div role="status">
      <h1>Course checks</h1>
      <p>Loading your course checks. The results will appear here when they are ready.</p>
    </div>
  );
}
