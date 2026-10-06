/**
 * @file What the search did not check, from the contract's fixed limitation codes.
 * @module @caa/web/features/schedule-options/components/limitations-list
 * @requirement FR-18
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import type { ScheduleLimitation } from '@caa/domain';

import { describeLimitation } from '../utils/option-wording';

/** Props for {@link LimitationsList}. */
export interface LimitationsListProps {
  readonly limitations: readonly ScheduleLimitation[];
}

/**
 * Lists every limitation as text, with its code.
 *
 * @param props - The limitation codes from the response.
 * @returns The section.
 */
export function LimitationsList({ limitations }: LimitationsListProps): ReactElement {
  return (
    <section aria-labelledby="limitations-heading">
      <h3 id="limitations-heading">What was not checked</h3>
      <ul>
        {limitations.map((code) => {
          const wording = describeLimitation(code);
          return (
            <li key={code}>
              <strong>{wording.label}.</strong> {wording.detail} (<code>{code}</code>)
            </li>
          );
        })}
      </ul>
    </section>
  );
}
