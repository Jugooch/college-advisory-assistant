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
import { CheckResultItem } from '@/shared/components/check-result-item';
import { CourseLabel } from '@/shared/components/course-label';
import { NO_CAMPUSES } from '@/shared/utils/campus-display';
import { describeAggregate } from '@/shared/utils/check-state-wording';
import type { CourseLookup } from '@/shared/utils/course-display';
import { describeAsOf } from '@/shared/utils/decisive-leaf-wording';

/** Props for {@link CourseCheckResults}. */
export interface CourseCheckResultsProps {
  readonly result: CourseChecksResponse;
  /** Catalog display entries by course ID, to name every course shown. */
  readonly courses: CourseLookup;
}

/** Props for the per-course section. */
interface CourseResultProps {
  readonly course: CourseChecksResponse['courseResults'][number];
  readonly asOf: string;
  readonly courses: CourseLookup;
}

/**
 * Renders one course's dimensions under its catalog name.
 *
 * @param props - The course result, the as-of text, and the display entries.
 * @returns The course section.
 */
function CourseResult({ course, asOf, courses }: CourseResultProps): ReactElement {
  const headingId = `result-course-${course.courseId}`;
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>
        <CourseLabel courseId={course.courseId} courses={courses} />
      </h3>
      <ul className="check-list">
        <CheckResultItem
          campuses={NO_CAMPUSES}
          dimension="Prerequisite"
          check={course.prerequisite}
          asOf={asOf}
          courses={courses}
        />
        <CheckResultItem
          campuses={NO_CAMPUSES}
          dimension="Requirement applicability"
          check={course.applicability}
          asOf={asOf}
          courses={courses}
        />
      </ul>
    </section>
  );
}

/**
 * Renders every result exactly as the API returned it.
 *
 * @param props - The course-checks response and the display entries.
 * @returns The results section.
 */
export function CourseCheckResults({ result, courses }: CourseCheckResultsProps): ReactElement {
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
        <CourseResult key={course.courseId} course={course} asOf={asOf} courses={courses} />
      ))}
      <section aria-labelledby="set-heading">
        <h3 id="set-heading">The courses together</h3>
        <ul className="check-list">
          {setResults.allocation.map((check, index) => (
            <CheckResultItem
              campuses={NO_CAMPUSES}
              key={`allocation-${String(index)}`}
              dimension={
                setResults.allocation.length === 1
                  ? 'Requirement allocation'
                  : `Requirement allocation, problem ${String(index + 1)}`
              }
              check={check}
              asOf={asOf}
              courses={courses}
            />
          ))}
          <CheckResultItem
            campuses={NO_CAMPUSES}
            dimension="Credit load"
            check={setResults.creditLoad}
            asOf={asOf}
            courses={courses}
          />
        </ul>
      </section>
    </section>
  );
}
