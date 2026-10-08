'use client';
/**
 * @file The results heading. The page reloads to show results, so a live region mounted with them
 * isn't reliably announced; moving focus here announces the finished search once.
 * @module @caa/web/shared/components/results-heading
 * @requirement NFR-02
 */
import { type ReactElement, useEffect, useRef } from 'react';

import { type HeadingLevel, headingTag } from '@/shared/utils/heading-level';

/** Props for {@link ResultsHeading}. */
export interface ResultsHeadingProps {
  /** Heading text; defaults to the search heading. */
  readonly text?: string | undefined;
  /** Whether focus moves here on first render. A saved result shown on load must not take it. */
  readonly isFocused?: boolean | undefined;
  /** The heading's id, so the section can name itself by it. */
  readonly id: string;
  /** The heading's level. Defaults to `2`. */
  readonly headingLevel?: HeadingLevel | undefined;
}

/**
 * Renders the results heading and, unless told not to, moves focus to it when it first appears.
 *
 * @param props - The optional text and focus choice.
 * @returns The heading.
 */
export function ResultsHeading({
  text = 'Schedule search results',
  isFocused = true,
  id,
  headingLevel = 2,
}: ResultsHeadingProps): ReactElement {
  const Heading = headingTag(headingLevel);
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (isFocused) {
      ref.current?.focus();
    }
  }, [isFocused]);
  return (
    <Heading id={id} ref={ref} tabIndex={isFocused ? -1 : undefined}>
      {text}
    </Heading>
  );
}
