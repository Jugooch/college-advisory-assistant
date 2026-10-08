/**
 * @file The verified conflicts behind a "no feasible plan" outcome.
 * @module @caa/web/shared/components/conflict-list
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-02
 */
import { type ReactElement, useId } from 'react';

import type { ConflictSet } from '@caa/api-contract';

import { CheckResultItem } from '@/shared/components/check-result-item';
import type { CampusLookup } from '@/shared/utils/campus-display';
import type { CourseLookup } from '@/shared/utils/course-display';
import { type HeadingLevel, headingTag, subHeadingLevel } from '@/shared/utils/heading-level';

/** Props for {@link ConflictList}. */
export interface ConflictListProps {
  readonly conflictSet: ConflictSet;
  readonly asOf: string;
  readonly courses: CourseLookup;
  readonly campuses: CampusLookup;
  /** Level of this card's heading; its sub-headings sit one level below. Defaults to `3`. */
  readonly headingLevel?: HeadingLevel;
}

/**
 * Lists each verified conflict, and says when more were left out.
 *
 * @param props - The conflict set, the as-of text, and the course names.
 * @returns The section.
 */
export function ConflictList({
  conflictSet,
  asOf,
  courses,
  campuses,
  headingLevel = 3,
}: ConflictListProps): ReactElement {
  const headingId = useId();
  const Heading = headingTag(headingLevel);
  return (
    <section aria-labelledby={headingId}>
      <Heading id={headingId}>Verified conflicts</Heading>
      <p>
        Each conflict below was verified. The list is not guaranteed to be the smallest set that
        explains why nothing fits.
      </p>
      <ul className="check-list">
        {conflictSet.items.map((check, index) => (
          <CheckResultItem
            key={`${String(index)}-${check.reasonCode ?? ''}`}
            dimension={`Conflict ${String(index + 1)}`}
            check={check}
            asOf={asOf}
            courses={courses}
            campuses={campuses}
            headingLevel={subHeadingLevel(headingLevel)}
          />
        ))}
      </ul>
      {conflictSet.omittedCount === 0 ? null : (
        <p>
          {conflictSet.omittedCount} more verified conflict
          {conflictSet.omittedCount === 1 ? ' is' : 's are'} not shown.
        </p>
      )}
    </section>
  );
}
