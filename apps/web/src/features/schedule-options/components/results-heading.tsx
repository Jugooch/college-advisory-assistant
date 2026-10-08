'use client';
/**
 * @file The results heading. The page reloads to show results, so a live region mounted with them
 * isn't reliably announced; moving focus here announces the finished search once.
 * @module @caa/web/features/schedule-options/components/results-heading
 * @requirement NFR-02
 */
import { type ReactElement, useEffect, useRef } from 'react';

/** Props for {@link ResultsHeading}. */
export interface ResultsHeadingProps {
  /** Heading text; defaults to the search heading. */
  readonly text?: string | undefined;
  /** Whether focus moves here on first render. A saved result shown on load must not take it. */
  readonly isFocused?: boolean | undefined;
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
}: ResultsHeadingProps): ReactElement {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (isFocused) {
      ref.current?.focus();
    }
  }, [isFocused]);
  return (
    <h2 id="results-heading" ref={ref} tabIndex={isFocused ? -1 : undefined}>
      {text}
    </h2>
  );
}
