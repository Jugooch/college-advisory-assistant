/**
 * @file A full-page notice on the advisor screens: a heading, what happened, and what to do next.
 * Used when the session is not an advisor's and when a case is not available.
 * @module @caa/web/features/advisor-cases/components/advisor-notice
 * @requirement FR-12
 * @requirement NFR-02
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

/** Props for {@link AdvisorNotice}. */
export interface AdvisorNoticeProps {
  /** Page heading. */
  readonly heading: string;
  readonly explanation: string;
  readonly nextStep: string;
  /** Where the next-step link goes. */
  readonly href: string;
  /** The next-step link text. */
  readonly linkLabel: string;
}

/**
 * Renders the notice.
 *
 * @param props - The wording and the link.
 * @returns The notice section.
 */
export function AdvisorNotice({
  heading,
  explanation,
  nextStep,
  href,
  linkLabel,
}: AdvisorNoticeProps): ReactElement {
  return (
    <section className="notice notice--problem" aria-labelledby="advisor-notice-heading">
      <h1 id="advisor-notice-heading">{heading}</h1>
      <p>{explanation}</p>
      <p>{nextStep}</p>
      <p>
        <Link href={href}>{linkLabel}</Link>
      </p>
    </section>
  );
}
