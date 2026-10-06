'use client';
/**
 * @file The results heading. The page reloads to show results, so a live region mounted with them
 * isn't reliably announced; moving focus here announces the finished search once.
 * @module @caa/web/features/schedule-options/components/results-heading
 * @requirement NFR-02
 */
import { type ReactElement, useEffect, useRef } from 'react';

/**
 * Renders the results heading and moves focus to it when it first appears.
 *
 * @returns The focusable heading.
 */
export function ResultsHeading(): ReactElement {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h2 id="results-heading" ref={ref} tabIndex={-1}>
      Schedule search results
    </h2>
  );
}
