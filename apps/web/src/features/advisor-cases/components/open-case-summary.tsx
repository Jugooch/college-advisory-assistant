/**
 * @file The Overview's case status: the student's open case in words, or that there is none, with
 * links to Help and cases and to report a problem. App-internal; no notification is sent.
 * @module @caa/web/features/advisor-cases/components/open-case-summary
 * @requirement FR-12
 * @requirement FR-17
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

import { CaseStatus } from '@caa/domain';

import { StatusBadge } from '@/components/ui/status-badge';
import { Timestamp } from '@/shared/components/timestamp';
import { describeCaseReason, describeCaseStatus } from '@/shared/utils/case-wording';

import type { CaseSummary } from '../utils/case-summary';

/** Props for {@link OpenCaseSummary}. */
export interface OpenCaseSummaryProps {
  /** The student's cases, newest first. */
  readonly cases: readonly CaseSummary[];
  readonly casesHref: string;
  readonly reportHref: string;
}

/** Shown when the student has no open case. */
export const NO_OPEN_CASES = 'You have no open advisor case.';

/**
 * Renders the open case status and the help links.
 *
 * @param props - The cases and the links.
 * @returns The section.
 */
export function OpenCaseSummary({
  cases,
  casesHref,
  reportHref,
}: OpenCaseSummaryProps): ReactElement {
  const open = cases.filter(
    (row) => row.status === CaseStatus.Open || row.status === CaseStatus.InReview,
  );
  return (
    <section aria-labelledby="open-case-heading">
      <h2 id="open-case-heading">Advisor help</h2>
      {open.length === 0 ? (
        <p>{NO_OPEN_CASES}</p>
      ) : (
        <ul>
          {open.map((row) => {
            const status = describeCaseStatus(row.status);
            return (
              <li key={row.id}>
                {describeCaseReason(row.reason)}, opened <Timestamp iso={row.createdAt} />:{' '}
                <StatusBadge label={status.label} tone={status.tone} /> {status.nextStep}
              </li>
            );
          })}
        </ul>
      )}
      <p>
        <Link href={casesHref}>Help and cases</Link>
      </p>
      <p>
        <Link href={reportHref}>Report a problem with my record</Link>
      </p>
    </section>
  );
}
