/**
 * @file A table that compares the options side by side, in a fixed column order.
 * @module @caa/web/shared/components/option-comparison
 * @requirement FR-09
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { ReactElement } from 'react';

import type { ScheduleOption } from '@caa/api-contract';

import { describeAggregate, describeCheckState } from '@/shared/utils/check-state-wording';
import { formatCredits } from '@/shared/utils/format-display';
import { optionHeadingId } from '@/shared/utils/option-heading-id';

/** Props for {@link OptionComparison}. */
export interface OptionComparisonProps {
  readonly options: readonly ScheduleOption[];
  readonly asOf: string;
  /** Unique to this results block; the option cards' heading ids are built from it. */
  readonly idPrefix: string;
}

/**
 * Renders the comparison table. States are the API's, as text.
 *
 * @param props - The options, the as-of text, and the id prefix of the option headings.
 * @returns The table.
 */
export function OptionComparison({ options, asOf, idPrefix }: OptionComparisonProps): ReactElement {
  return (
    <table className="comparison">
      <caption>Open an option below for its sections and evidence.</caption>
      <thead>
        <tr>
          <th scope="col">Option</th>
          <th scope="col">Overall state</th>
          <th scope="col">Schedule feasibility</th>
          <th scope="col">Credit load</th>
          <th scope="col">Total credits</th>
          <th scope="col">Missed preferences</th>
        </tr>
      </thead>
      <tbody>
        {options.map((option) => {
          const total = option.setResults.creditLoad.evidence?.creditLoad?.totalCreditsHundredths;
          return (
            <tr key={option.rank}>
              <th scope="row">
                <a href={`#${optionHeadingId(idPrefix, option.rank)}`}>Option {option.rank}</a>
              </th>
              <td data-label="Overall state">{describeAggregate(option.aggregate).label}</td>
              <td data-label="Schedule feasibility">
                {describeCheckState(option.scheduleFeasibility.state, asOf).label}
              </td>
              <td data-label="Credit load">
                {describeCheckState(option.setResults.creditLoad.state, asOf).label}
              </td>
              <td data-label="Total credits">
                {total === undefined ? 'Not determined' : formatCredits(total)}
              </td>
              <td data-label="Missed preferences">{option.unmetPreferences.length}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
