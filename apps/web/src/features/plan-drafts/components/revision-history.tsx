/**
 * @file The revision history: every revision from 1 to the latest as a list of links. Each link
 * opens that revision read-only, so the list works with the keyboard and without scripts.
 * @module @caa/web/features/plan-drafts/components/revision-history
 * @requirement FR-11
 * @requirement NFR-05
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

import type { PlanView } from '@caa/api-contract';

import { Timestamp } from '@/shared/components/timestamp';

import { describeRevisionCause } from '../utils/plan-detail-wording';

/** Props for {@link RevisionHistory}. */
export interface RevisionHistoryProps {
  readonly revisions: PlanView['revisions'];
  /** The revision on screen. */
  readonly shownRevision: number;
  /** Builds the link to one revision. */
  readonly revisionHref: (revision: number) => string;
}

/**
 * Renders the history, newest first, with the revision on screen marked in text.
 *
 * @param props - The index entries, the revision on screen, and the link builder.
 * @returns The history navigation.
 */
export function RevisionHistory({
  revisions,
  shownRevision,
  revisionHref,
}: RevisionHistoryProps): ReactElement {
  const latest = revisions.length;
  return (
    <nav aria-labelledby="history-heading">
      <h2 id="history-heading">Revision history</h2>
      <ol reversed>
        {[...revisions].reverse().map((entry) => (
          <li key={entry.revision} value={entry.revision}>
            <Link
              href={revisionHref(entry.revision)}
              aria-current={entry.revision === shownRevision ? 'page' : undefined}
            >
              Revision {entry.revision}
            </Link>
            {' · '}
            {describeRevisionCause(entry.cause)} <Timestamp iso={entry.createdAt} />
            {entry.revision === latest ? ' · Latest' : ''}
            {entry.revision === shownRevision ? ' · Showing now' : ''}
          </li>
        ))}
      </ol>
    </nav>
  );
}
