/**
 * @file One schedule option: its validation state first, then courses and sections, credits,
 * every check, and the preferences it misses.
 * @module @caa/web/features/schedule-options/components/option-card
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import type { ScheduleOption } from '@caa/api-contract';

import { StatusBadge } from '@/components/ui/status-badge';
import { describeAggregate } from '@/shared/utils/check-state-wording';
import type { CourseLookup } from '@/shared/utils/course-display';
import { formatCredits } from '@/shared/utils/format-display';

import { describeUnmetPreference } from '../utils/option-wording';
import { OptionChecks } from './option-checks';
import { SectionList } from './section-list';

/** Props for {@link OptionCard}. */
export interface OptionCardProps {
  readonly option: ScheduleOption;
  readonly asOf: string;
  readonly courses: CourseLookup;
}

/**
 * Renders one option as an article.
 *
 * @param props - The option, the as-of text, and the course names.
 * @returns The option card.
 */
export function OptionCard({ option, asOf, courses }: OptionCardProps): ReactElement {
  const aggregate = describeAggregate(option.aggregate);
  const total = option.setResults.creditLoad.evidence?.creditLoad?.totalCreditsHundredths;
  const headingId = `option-${String(option.rank)}-heading`;
  return (
    <article className="option-card" aria-labelledby={headingId}>
      <h3 id={headingId}>Option {option.rank}</h3>
      <p>
        <StatusBadge label={aggregate.label} tone={aggregate.tone} /> {aggregate.explanation}
      </p>
      <h4>Courses and sections</h4>
      <SectionList bundles={option.bundles} courses={courses} />
      <h4>Credits</h4>
      <p>
        Total credits: {total === undefined ? 'not determined' : `${formatCredits(total)} credits`}
      </p>
      <h4>Preferences this option misses</h4>
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
      <h4>Checks, shown separately</h4>
      <OptionChecks option={option} asOf={asOf} courses={courses} />
    </article>
  );
}
