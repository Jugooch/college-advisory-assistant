/**
 * @file The results of a schedule search: the outcome, what couldn't be resolved, the options or
 * conflicts, and what was not checked. Every state is shown as the API returned it.
 * @module @caa/web/features/schedule-options/components/schedule-results
 * @requirement FR-09
 * @requirement FR-10
 * @requirement FR-18
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { ReactElement } from 'react';

import type { ScheduleOptionsResponse } from '@caa/api-contract';

import { indexCampuses } from '@/shared/utils/campus-display';
import { type CourseLookup, indexCourses } from '@/shared/utils/course-display';
import { describeAsOf } from '@/shared/utils/decisive-leaf-wording';

import { describeDateRange } from '../utils/meeting-wording';
import { ConflictList } from './conflict-list';
import { LimitationsList } from './limitations-list';
import { OptionCard } from './option-card';
import { OptionComparison } from './option-comparison';
import { OutcomeNotice } from './outcome-notice';
import { PinnedInputs } from './pinned-inputs';
import { ResultsHeading } from './results-heading';
import { UnresolvedList } from './unresolved-list';

/** Props for {@link ScheduleResults}. */
export interface ScheduleResultsProps {
  readonly result: ScheduleOptionsResponse;
  /** Course names the page already has; the response's own entries are added to them. */
  readonly courses: CourseLookup;
}

/**
 * Renders a finished search. Nothing here implies a registration or open seats.
 *
 * @param props - The response and course names.
 * @returns The results section.
 */
export function ScheduleResults({ result, courses }: ScheduleResultsProps): ReactElement {
  const names = indexCourses(result.courses, [...courses.values()]);
  const campuses = indexCampuses(result.campuses);
  const asOf = describeAsOf(result.pinnedInputs);
  return (
    <section aria-labelledby="results-heading">
      <ResultsHeading />
      <p>
        Term: {result.term.termCode} ({describeDateRange(result.term.startsOn, result.term.endsOn)})
      </p>
      <OutcomeNotice outcome={result.outcome} searchComplete={result.searchComplete} />
      <LimitationsList limitations={result.limitations} />
      <UnresolvedList
        unresolved={result.unresolved}
        asOf={asOf}
        courses={names}
        campuses={campuses}
      />
      {result.conflictSet === null ? null : (
        <ConflictList
          conflictSet={result.conflictSet}
          asOf={asOf}
          courses={names}
          campuses={campuses}
        />
      )}
      {result.options.length === 0 ? null : (
        <section aria-labelledby="options-heading">
          <h3 id="options-heading">Options</h3>
          <OptionComparison options={result.options} asOf={asOf} />
          {result.options.map((option) => (
            <OptionCard
              key={option.rank}
              option={option}
              asOf={asOf}
              courses={names}
              campuses={campuses}
            />
          ))}
        </section>
      )}
      <PinnedInputs pinned={result.pinnedInputs} searchComplete={result.searchComplete} />
    </section>
  );
}
