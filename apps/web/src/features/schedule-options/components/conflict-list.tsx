/**
 * @file The verified conflicts behind a "no feasible plan" outcome.
 * @module @caa/web/features/schedule-options/components/conflict-list
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import type { ConflictSet } from '@caa/api-contract';

import { CheckResultItem } from '@/shared/components/check-result-item';
import type { CampusLookup } from '@/shared/utils/campus-display';
import type { CourseLookup } from '@/shared/utils/course-display';

/** Props for {@link ConflictList}. */
export interface ConflictListProps {
  readonly conflictSet: ConflictSet;
  readonly asOf: string;
  readonly courses: CourseLookup;
  readonly campuses: CampusLookup;
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
}: ConflictListProps): ReactElement {
  return (
    <section aria-labelledby="conflicts-heading">
      <h3 id="conflicts-heading">Verified conflicts</h3>
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
