/**
 * @file Approved policy hits as structured fields: title, excerpt as plain text, revision,
 * effective interval, source label, approval time, and a conflict notice.
 * @module @caa/web/shared/components/policy-hit-list
 * @requirement FR-16
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ReactElement } from 'react';

import type { PolicyHit } from '@caa/api-contract';

import { Timestamp } from '@/shared/components/timestamp';
import { type HeadingLevel, headingTag } from '@/shared/utils/heading-level';

/** Props for {@link PolicyHitList}. */
export interface PolicyHitListProps {
  /** Hits exactly as the API returned them. */
  readonly hits: readonly PolicyHit[];
  /** Heading level for each hit's title. */
  readonly headingLevel: HeadingLevel;
}

/**
 * Shows each approved policy hit as structured fields so a student sees where a rule came from
 * and when it applies. Text is rendered as React text, so no HTML, Markdown or link in it is
 * interpreted. The excerpt is never summarized or turned into an academic claim.
 *
 * @param props - The hits and heading level.
 * @returns The list.
 */
export function PolicyHitList({ hits, headingLevel }: PolicyHitListProps): ReactElement {
  const Heading = headingTag(headingLevel);
  return (
    <ul className="policy-hit-list">
      {hits.map((hit) => (
        <li key={hit.documentKey} className="policy-hit">
          <Heading className="policy-hit__title">{hit.title}</Heading>
          {hit.conflict ? (
            <p role="note" className="notice notice--caution policy-hit__conflict">
              <strong>Possible conflict:</strong> another result on this page covers the same
              subject and may disagree. Ask your advising office which applies.
            </p>
          ) : null}
          <p className="policy-hit__excerpt">{hit.excerpt}</p>
          <dl className="facts policy-hit__source">
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
