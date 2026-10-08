/**
 * @file One schedule option: its validation state first, then courses and sections, credits,
 * every check, and the preferences it misses.
 * @module @caa/web/shared/components/option-card
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-02
 */
import { type ReactElement, type ReactNode, useId } from 'react';

import type { ScheduleOption } from '@caa/api-contract';

import { StatusBadge } from '@/components/ui/status-badge';
import type { CampusLookup } from '@/shared/utils/campus-display';
import { describeAggregate } from '@/shared/utils/check-state-wording';
import type { CourseLookup } from '@/shared/utils/course-display';
import { formatCredits } from '@/shared/utils/format-display';
import { type HeadingLevel, headingTag, subHeadingLevel } from '@/shared/utils/heading-level';
import { describeUnmetPreference } from '@/shared/utils/option-wording';

import { OptionChecks } from './option-checks';
import { SectionList } from './section-list';

/** Props for {@link OptionCard}. */
export interface OptionCardProps {
  readonly option: ScheduleOption;
  readonly asOf: string;
  readonly courses: CourseLookup;
  readonly campuses: CampusLookup;
  /** Controls for this option, such as saving it as a draft; supplied by the page. */
  readonly actions?: ReactNode;
  /** Level of this card's heading; its sub-headings sit one level below. Defaults to `3`. */
  readonly headingLevel?: HeadingLevel;
}

/**
 * Renders one option as an article.
 *
 * @param props - The option, the as-of text, the course names, and any controls.
 * @returns The option card.
 */
export function OptionCard({
  option,
  asOf,
  courses,
  campuses,
  actions,
  headingLevel = 3,
}: OptionCardProps): ReactElement {
  const aggregate = describeAggregate(option.aggregate);
  const total = option.setResults.creditLoad.evidence?.creditLoad?.totalCreditsHundredths;
  const headingId = useId();
  const Heading = headingTag(headingLevel);
  const SubHeading = headingTag(subHeadingLevel(headingLevel));
  return (
    <article className="option-card" aria-labelledby={headingId}>
      <Heading id={headingId}>Option {option.rank}</Heading>
      <p>
        <StatusBadge label={aggregate.label} tone={aggregate.tone} /> {aggregate.explanation}
      </p>
      <SubHeading>Courses and sections</SubHeading>
      <SectionList bundles={option.bundles} courses={courses} campuses={campuses} />
      <SubHeading>Credits</SubHeading>
      <p>
        Total credits: {total === undefined ? 'not determined' : `${formatCredits(total)} credits`}
      </p>
      <SubHeading>Preferences this option misses</SubHeading>
      {option.unmetPreferences.length === 0 ? (
        <p>No preference is missed by this option.</p>
      ) : (
        <ul>
          {option.unmetPreferences.map((unmet) => (
            <li
              key={`${String(unmet.constraintIndex)}-${unmet.sectionId ?? ''}-${String(unmet.meetingIndex)}`}
            >
              {describeUnmetPreference(unmet)}
            </li>
          ))}
        </ul>
      )}
      <SubHeading>Checks, shown separately</SubHeading>
      <OptionChecks
        option={option}
        asOf={asOf}
        courses={courses}
        campuses={campuses}
        headingLevel={subHeadingLevel(headingLevel)}
      />
      {actions === undefined ? null : (
        <>
          <SubHeading>Keep this option</SubHeading>
          {actions}
        </>
      )}
    </article>
  );
}
