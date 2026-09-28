/**
 * @file The results of a course check: the aggregate with its limits, each course's dimensions
 * separately, and the set-level checks.
 * @module @caa/web/features/course-checks/components/course-check-results
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { ReactElement } from 'react';

import type { CourseChecksResponse } from '@caa/api-contract';

import { StatusBadge } from '@/components/ui/status-badge';
import { describeAggregate } from '@/features/verification-states/utils/check-state-wording';

import { describeAsOf } from '../utils/decisive-leaf-wording';
import { CheckResultItem } from './check-result-item';

/** Props for {@link CourseCheckResults}. */
export interface CourseCheckResultsProps {
  readonly result: CourseChecksResponse;
}

/**
 * Renders every result exactly as the API returned it.
 *
 * @param props - The course-checks response.
 * @returns The results section.
 */
export function CourseCheckResults({ result }: CourseCheckResultsProps): ReactElement {
  const { pinnedInputs: pinned, setResults } = result;
  const asOf = describeAsOf(pinned);
  const aggregate = describeAggregate(result.aggregate);
  return (
    <section aria-labelledby="results-heading">
      <h2 id="results-heading">Check results</h2>
      <p>
        Overall: <StatusBadge label={aggregate.label} tone={aggregate.tone} />{' '}
        {aggregate.explanation}
      </p>
      <p>
        This checks a possible plan. It doesn’t register you, hold a seat, or check your schedule.
        Results hold as of {asOf}, using ruleset {pinned.rulesetVersion} and audit{' '}
        <code>
          {pinned.auditSource} {pinned.auditVersion}
        </code>
        .
      </p>
      {result.courseResults.map((course) => (
        <section key={course.courseId} aria-labelledby={`course-${course.courseId}`}>
          <h3 id={`course-${course.courseId}`}>
            Course <code>{course.courseId}</code>
          </h3>
          <ul className="check-list">
            <CheckResultItem dimension="Prerequisite" check={course.prerequisite} asOf={asOf} />
            <CheckResultItem
              dimension="Requirement applicability"
              check={course.applicability}
              asOf={asOf}
            />
          </ul>
        </section>
      ))}
      <section aria-labelledby="set-heading">
        <h3 id="set-heading">The courses together</h3>
        <ul className="check-list">
          {setResults.allocation.map((check, index) => (
            <CheckResultItem
              key={`allocation-${String(index)}`}
              dimension={
                setResults.allocation.length === 1
                  ? 'Requirement allocation'
                  : `Requirement allocation, problem ${String(index + 1)}`
              }
              check={check}
              asOf={asOf}
            />
          ))}
          <CheckResultItem dimension="Credit load" check={setResults.creditLoad} asOf={asOf} />
        </ul>
      </section>
    </section>
  );
}
