/**
 * @file The error summary: every issue that stopped the review, linked to its field.
 * @module @caa/web/features/next-term-planner/components/issue-summary
 * @requirement FR-08
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import { plannerFieldId } from '../utils/planner-fields';
import type { PlannerIssue } from '../utils/planner-plan';

/**
 * Returns the id of the element an issue links to.
 *
 * @param name - The issue's field name.
 * @returns The element id.
 */
function targetId(name: string): string {
  if (name === 'course') {
    return 'planner-course-hint';
  }
  return name.startsWith('credits-')
    ? `pick-credits-${name.slice('credits-'.length)}`
    : plannerFieldId(name);
}

/**
 * Renders the summary, or nothing when there are no issues. Contradictions are listed as they
 * are: the form never changes what the student entered.
 *
 * @param props - The issues.
 * @returns The summary.
 */
export function IssueSummary({
  issues,
}: {
  readonly issues: readonly PlannerIssue[];
}): ReactElement | null {
  if (issues.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="issues-heading" role="alert" className="issue-summary">
      <h2 id="issues-heading">Fix these before reviewing</h2>
      <p>Nothing was changed for you. Correct the entries below, then review again.</p>
      <ul>
        {issues.map((issue) => (
          <li key={`${issue.name ?? 'set'}-${issue.message}`}>
            {issue.name === null ? (
              issue.message
            ) : (
              <a href={`#${targetId(issue.name)}`}>{issue.message}</a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
