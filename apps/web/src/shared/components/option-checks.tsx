/**
 * @file Every validation dimension of one option, shown separately and exactly as returned.
 * @module @caa/web/shared/components/option-checks
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import type { ScheduleOption } from '@caa/api-contract';

import { CheckResultItem } from '@/shared/components/check-result-item';
import type { CampusLookup } from '@/shared/utils/campus-display';
import { type CourseLookup, describeCourse } from '@/shared/utils/course-display';
import type { HeadingLevel } from '@/shared/utils/heading-level';

/** Props for {@link OptionChecks}. */
export interface OptionChecksProps {
  readonly option: ScheduleOption;
  /** What passed checks hold for, for example the record and audit times. */
  readonly asOf: string;
  readonly courses: CourseLookup;
  readonly campuses: CampusLookup;
  /** Level of this card's heading; its sub-headings sit one level below. Defaults to `4`. */
  readonly headingLevel?: HeadingLevel;
}

/**
 * Lists schedule feasibility, then each course's prerequisite and applicability (linked
 * courses included), then allocation and credit load. No dimension is merged into another.
 *
 * @param props - The option, the as-of text, and the course names.
 * @returns A list with one item per check.
 */
export function OptionChecks({
  option,
  asOf,
  courses,
  campuses,
  headingLevel = 4,
}: OptionChecksProps): ReactElement {
  const { setResults } = option;
  const shared = { asOf, courses, campuses, headingLevel };
  const perCourse = [
    ...option.courseResults.map((result) => ({ result, suffix: '' })),
    ...option.linkedCourseResults.map((result) => ({ result, suffix: ' (linked section)' })),
  ];
  return (
    <ul className="check-list">
      <CheckResultItem
        dimension="Schedule feasibility"
        check={option.scheduleFeasibility}
        {...shared}
      />
      {perCourse.flatMap(({ result, suffix }) => {
        const name = `${describeCourse(result.courseId, courses)}${suffix}`;
        return [
          <CheckResultItem
            key={`${result.courseId}-prerequisite`}
            dimension={`Prerequisite for ${name}`}
            check={result.prerequisite}
            ruleName="prerequisite"
            {...shared}
          />,
          <CheckResultItem
            key={`${result.courseId}-applicability`}
            dimension={`Applicability of ${name}`}
            check={result.applicability}
            {...shared}
          />,
        ];
      })}
      {setResults.allocation.map((check, index) => (
        <CheckResultItem
          key={`allocation-${String(index)}`}
          dimension={
            setResults.allocation.length === 1
              ? 'Requirement allocation'
              : `Requirement allocation ${String(index + 1)}`
          }
          check={check}
          {...shared}
        />
      ))}
      <CheckResultItem dimension="Credit load" check={setResults.creditLoad} {...shared} />
    </ul>
  );
}
