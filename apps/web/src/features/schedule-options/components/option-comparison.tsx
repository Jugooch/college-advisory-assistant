/**
 * @file A table that compares the options side by side, in a fixed column order.
 * @module @caa/web/features/schedule-options/components/option-comparison
 * @requirement FR-09
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { ReactElement } from 'react';

import type { ScheduleOption } from '@caa/api-contract';

import { describeAggregate, describeCheckState } from '@/shared/utils/check-state-wording';
import { formatCredits } from '@/shared/utils/format-display';

/** Props for {@link OptionComparison}. */
export interface OptionComparisonProps {
  readonly options: readonly ScheduleOption[];
  readonly asOf: string;
}

/**
 * Renders the comparison table. States are the API's, as text.
 *
 * @param props - The options and the as-of text.
 * @returns The table.
 */
export function OptionComparison({ options, asOf }: OptionComparisonProps): ReactElement {
  return (
    <table>
      <caption>Options compared. Open an option below for its sections and evidence.</caption>
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
                <a href={`#option-${String(option.rank)}-heading`}>Option {option.rank}</a>
              </th>
              <td>{describeAggregate(option.aggregate).label}</td>
              <td>{describeCheckState(option.scheduleFeasibility.state, asOf).label}</td>
              <td>{describeCheckState(option.setResults.creditLoad.state, asOf).label}</td>
              <td>{total === undefined ? 'Not determined' : formatCredits(total)}</td>
              <td>{option.unmetPreferences.length}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
