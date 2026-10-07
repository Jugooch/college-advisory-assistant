/**
 * @file Items the search couldn't resolve. Shown for every outcome, so uncertainty is never
 * hidden behind a result that looks complete.
 * @module @caa/web/features/schedule-options/components/unresolved-list
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import type { ScheduleOptionsResponse } from '@caa/api-contract';

import { CheckResultItem } from '@/shared/components/check-result-item';
import type { CampusLookup } from '@/shared/utils/campus-display';
import type { CourseLookup } from '@/shared/utils/course-display';

/** Props for {@link UnresolvedList}. */
export interface UnresolvedListProps {
  readonly unresolved: ScheduleOptionsResponse['unresolved'];
  readonly asOf: string;
  readonly courses: CourseLookup;
  readonly campuses: CampusLookup;
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
}: UnresolvedListProps): ReactElement {
  return (
    <section aria-labelledby="unresolved-heading">
      <h3 id="unresolved-heading">Not resolved</h3>
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
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
