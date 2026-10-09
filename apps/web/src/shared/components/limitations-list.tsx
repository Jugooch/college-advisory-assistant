/**
 * @file What the search did not check, from the contract's fixed limitation codes.
 * @module @caa/web/shared/components/limitations-list
 * @requirement FR-18
 * @requirement NFR-02
 */
import { type ReactElement, useId } from 'react';

import type { ScheduleLimitation } from '@caa/domain';

import { type HeadingLevel, headingTag } from '@/shared/utils/heading-level';
import { describeLimitation } from '@/shared/utils/option-wording';

/** Props for {@link LimitationsList}. */
export interface LimitationsListProps {
  readonly limitations: readonly ScheduleLimitation[];
  /** Level of this card's heading; its sub-headings sit one level below. Defaults to `3`. */
  readonly headingLevel?: HeadingLevel;
}

/**
 * Lists every limitation as text, with its code.
 *
 * @param props - The limitation codes from the response.
 * @returns The section.
 */
export function LimitationsList({
  limitations,
  headingLevel = 3,
}: LimitationsListProps): ReactElement {
  const headingId = useId();
  const Heading = headingTag(headingLevel);
  return (
    <section aria-labelledby={headingId}>
      <Heading id={headingId}>What was not checked</Heading>
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
