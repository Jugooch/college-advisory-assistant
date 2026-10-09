/**
 * @file The "Where to ask" list: one entry per specialist topic, crisis first, each showing the
 * tenant's approved referral document or a fixed line to ask the advising office.
 * @module @caa/web/features/policy-help/components/where-to-ask
 * @requirement FR-16
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ReactElement } from 'react';

import type { ApiError, PolicySearchResponse } from '@caa/api-contract';
import type { SpecialistTopic } from '@caa/domain';

import { PolicyHitList } from '@/shared/components/policy-hit-list';

import { ASK_ADVISING_OFFICE, describeTopic } from '../utils/topic-wording';

/** One topic with the API's answer for it. */
export interface WhereToAskEntry {
  /** The specialist topic. */
  readonly topic: SpecialistTopic;
  /** The referral documents found, or the error when the source was unavailable. */
  readonly result: PolicySearchResponse | ApiError;
}

/** Props for {@link WhereToAsk}. */
export interface WhereToAskProps {
  /** Entries in display order. */
  readonly entries: readonly WhereToAskEntry[];
}

/**
 * Renders the list. A failed lookup says so for that topic and still points to the office.
 *
 * @param props - The entries in display order.
 * @returns The section.
 */
export function WhereToAsk({ entries }: WhereToAskProps): ReactElement {
  return (
    <section className="where-to-ask" aria-labelledby="where-to-ask-heading">
      <h2 id="where-to-ask-heading">Where to ask</h2>
      <ul className="where-to-ask__list">
        {entries.map(({ topic, result }) => (
          <li key={topic} className="where-to-ask__topic">
            <h3>{describeTopic(topic)}</h3>
            {'hits' in result ? (
              result.hits.length === 0 ? (
                <p>{ASK_ADVISING_OFFICE}</p>
              ) : (
                <PolicyHitList hits={result.hits} headingLevel={4} />
              )
            ) : (
              <p className="notice notice--caution where-to-ask__unavailable">
                <strong>Unavailable:</strong> the referral information for this topic is unavailable
                right now (support reference: {result.requestId ?? 'none'}). {ASK_ADVISING_OFFICE}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
