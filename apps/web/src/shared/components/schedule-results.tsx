/**
 * @file The results of a schedule search: the outcome, what couldn't be resolved, the options or
 * conflicts, and what was not checked. Every state is shown as the API returned it.
 * @module @caa/web/shared/components/schedule-results
 * @requirement FR-09
 * @requirement FR-10
 * @requirement FR-18
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import { type ReactElement, type ReactNode, useId } from 'react';

import type { ScheduleOption, ScheduleOptionsResponse } from '@caa/api-contract';

import { type CampusLookup, indexCampuses } from '@/shared/utils/campus-display';
import { type CourseLookup, indexCourses } from '@/shared/utils/course-display';
import { describeAsOf } from '@/shared/utils/decisive-leaf-wording';
import { type HeadingLevel, headingTag, subHeadingLevel } from '@/shared/utils/heading-level';
import { describeDateRange } from '@/shared/utils/meeting-wording';

import { ConflictList } from './conflict-list';
import { LimitationsList } from './limitations-list';
import { OptionCard } from './option-card';
import { OptionComparison } from './option-comparison';
import { OutcomeNotice } from './outcome-notice';
import { PinnedInputs } from './pinned-inputs';
import { ResultsHeading } from './results-heading';
import { UnresolvedList } from './unresolved-list';

/** No page-level course names. */
const NO_COURSES: CourseLookup = new Map();

/** Props for {@link ScheduleResults}. */
export interface ScheduleResultsProps {
  readonly result: ScheduleOptionsResponse;
  /**
   * Course names the page already has; the response's own entries are added to them. Chat has
   * none, so a course the response does not name shows its code and says no details are available.
   */
  readonly courses?: CourseLookup;
  /**
   * Builds the save-as-draft control for one option, or for the whole result when it has no
   * options (`null`). The page supplies it, so this feature knows nothing about drafts.
   */
  readonly renderSaveDraft?: (option: ScheduleOption | null) => ReactNode;
  /** Heading text; defaults to the search heading. A saved result names its "as of" time here. */
  readonly heading?: string;
  /** Whether focus moves to the heading on load. Saved results pass `false`. */
  readonly isHeadingFocused?: boolean;
  /** Level of this card's heading; its sections sit one level below. Defaults to `2`. */
  readonly headingLevel?: HeadingLevel;
}

/** Props for {@link OptionsSection}. */
interface OptionsSectionProps {
  readonly result: ScheduleOptionsResponse;
  readonly asOf: string;
  readonly courses: CourseLookup;
  readonly campuses: CampusLookup;
  readonly renderSaveDraft: ScheduleResultsProps['renderSaveDraft'];
  /** The level of the section's heading; each option card sits at the same level. */
  readonly headingLevel: HeadingLevel;
}

/**
 * Renders the options, or the save control for a result with none.
 *
 * @param props - The result, display names, the save control, and the heading level.
 * @returns The options section, the keep-this-result section, or nothing.
 */
function OptionsSection({
  result,
  asOf,
  courses,
  campuses,
  renderSaveDraft,
  headingLevel,
}: OptionsSectionProps): ReactElement | null {
  const optionsId = useId();
  const saveId = useId();
  const Heading = headingTag(headingLevel);
  if (result.options.length === 0) {
    return renderSaveDraft === undefined ? null : (
      <section aria-labelledby={saveId}>
        <Heading id={saveId}>Keep this result</Heading>
        {renderSaveDraft(null)}
      </section>
    );
  }
  return (
    <section aria-labelledby={optionsId}>
      <Heading id={optionsId}>Options</Heading>
      <OptionComparison options={result.options} asOf={asOf} />
      {result.options.map((option) => (
        <OptionCard
          key={option.rank}
          option={option}
          asOf={asOf}
          courses={courses}
          campuses={campuses}
          actions={renderSaveDraft?.(option)}
          headingLevel={headingLevel}
        />
      ))}
    </section>
  );
}

/**
 * Renders a finished search. Nothing here implies a registration or open seats.
 *
 * @param props - The response, course names, the optional save control, and the heading choices.
 * @returns The results section.
 */
export function ScheduleResults({
  result,
  courses = NO_COURSES,
  renderSaveDraft,
  heading,
  isHeadingFocused,
  headingLevel = 2,
}: ScheduleResultsProps): ReactElement {
  const resultsId = useId();
  const sectionLevel = subHeadingLevel(headingLevel);
  const names = indexCourses(result.courses, [...courses.values()]);
  const campuses = indexCampuses(result.campuses);
  const asOf = describeAsOf(result.pinnedInputs);
  return (
    <section aria-labelledby={resultsId}>
      <ResultsHeading
        id={resultsId}
        text={heading}
        isFocused={isHeadingFocused}
        headingLevel={headingLevel}
      />
      <p>
        Term: {result.term.termCode} ({describeDateRange(result.term.startsOn, result.term.endsOn)})
      </p>
      <OutcomeNotice
        outcome={result.outcome}
        searchComplete={result.searchComplete}
        headingLevel={sectionLevel}
      />
      <LimitationsList limitations={result.limitations} headingLevel={sectionLevel} />
      <UnresolvedList
        unresolved={result.unresolved}
        asOf={asOf}
        courses={names}
        campuses={campuses}
        headingLevel={sectionLevel}
      />
      {result.conflictSet === null ? null : (
        <ConflictList
          conflictSet={result.conflictSet}
          asOf={asOf}
          courses={names}
          campuses={campuses}
          headingLevel={sectionLevel}
        />
      )}
      <OptionsSection
        result={result}
        asOf={asOf}
        courses={names}
        campuses={campuses}
        renderSaveDraft={renderSaveDraft}
        headingLevel={sectionLevel}
      />
      <PinnedInputs pinned={result.pinnedInputs} searchComplete={result.searchComplete} />
    </section>
  );
}
