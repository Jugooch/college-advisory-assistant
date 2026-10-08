/**
 * @file Approved policy hits as structured fields: title, excerpt as plain text, revision,
 * effective interval, source label, approval time, and a conflict notice.
 * @module @caa/web/features/policy-help/components/policy-hit-list
 * @requirement FR-16
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ReactElement } from 'react';

import type { PolicyHit } from '@caa/api-contract';

import { Timestamp } from '@/shared/components/timestamp';

/** Props for {@link PolicyHitList}. */
export interface PolicyHitListProps {
  /** Hits exactly as the API returned them. */
  readonly hits: readonly PolicyHit[];
  /** Heading level for each hit's title. */
  readonly headingLevel: 3 | 4;
}

/**
 * Renders each hit. Text is rendered as React text, so no HTML, Markdown or link in it is
 * interpreted. The excerpt is never summarized or turned into an academic claim.
 *
 * @param props - The hits and heading level.
 * @returns The list.
 */
export function PolicyHitList({ hits, headingLevel }: PolicyHitListProps): ReactElement {
  const Heading = headingLevel === 3 ? 'h3' : 'h4';
  return (
    <ul className="policy-hits">
      {hits.map((hit) => (
        <li key={hit.documentKey}>
          <Heading>{hit.title}</Heading>
          {hit.conflict ? (
            <p role="note">
              <strong>Possible conflict:</strong> another result on this page covers the same
              subject and may disagree. Ask your advising office which applies.
            </p>
          ) : null}
          <p style={{ whiteSpace: 'pre-wrap' }}>{hit.excerpt}</p>
          <dl>
            <dt>Source</dt>
            <dd>{hit.sourceLabel}</dd>
            <dt>Revision</dt>
            <dd>{hit.revision}</dd>
            <dt>Effective</dt>
            <dd>
              from <Timestamp iso={hit.effectiveFrom} />{' '}
              {hit.effectiveTo === null ? (
                'with no end date'
              ) : (
                <>
                  until <Timestamp iso={hit.effectiveTo} />
                </>
              )}
            </dd>
            <dt>Approved</dt>
            <dd>
              <Timestamp iso={hit.approvedAt} />
            </dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}
