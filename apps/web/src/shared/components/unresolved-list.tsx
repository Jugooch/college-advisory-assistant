/**
 * @file Items the search couldn't resolve. Shown for every outcome, so uncertainty is never
 * hidden behind a result that looks complete.
 * @module @caa/web/shared/components/unresolved-list
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-02
 */
import { type ReactElement, useId } from 'react';

import type { ScheduleOptionsResponse } from '@caa/api-contract';

import { CheckResultItem } from '@/shared/components/check-result-item';
import type { CampusLookup } from '@/shared/utils/campus-display';
import type { CourseLookup } from '@/shared/utils/course-display';
import { type HeadingLevel, headingTag, subHeadingLevel } from '@/shared/utils/heading-level';

/** Props for {@link UnresolvedList}. */
export interface UnresolvedListProps {
  readonly unresolved: ScheduleOptionsResponse['unresolved'];
  readonly asOf: string;
  readonly courses: CourseLookup;
  readonly campuses: CampusLookup;
  /** Level of this card's heading; its sub-headings sit one level below. Defaults to `3`. */
  readonly headingLevel?: HeadingLevel;
}

/**
 * Lists unresolved items, or says there are none.
 *
 * @param props - The unresolved checks, the as-of text, and the course and campus names.
 * @returns The section.
 */
export function UnresolvedList({
  unresolved,
  asOf,
  courses,
  campuses,
  headingLevel = 3,
}: UnresolvedListProps): ReactElement {
  const headingId = useId();
  const Heading = headingTag(headingLevel);
  return (
    <section aria-labelledby={headingId}>
      <Heading id={headingId}>Not resolved</Heading>
      {unresolved.length === 0 ? (
        <p>Nothing was left unresolved by this search.</p>
      ) : (
        <>
          <p>
            These couldn’t be decided from the published data. They are not passing, and they are
            not failures.
          </p>
          <ul className="check-list">
            {unresolved.map((check, index) => (
              <CheckResultItem
                key={`${String(index)}-${check.reasonCode ?? ''}`}
                dimension={`Unresolved item ${String(index + 1)}`}
                check={check}
                asOf={asOf}
                courses={courses}
                campuses={campuses}
                headingLevel={subHeadingLevel(headingLevel)}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
