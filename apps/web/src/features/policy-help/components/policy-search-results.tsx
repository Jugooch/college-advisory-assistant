/**
 * @file Policy search results inside a polite live region: hits, no-result, or source outage.
 * @module @caa/web/features/policy-help/components/policy-search-results
 * @requirement FR-16
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ReactElement } from 'react';

import type { ApiError, PolicySearchResponse } from '@caa/api-contract';

import { ApiErrorNotice } from '@/shared/components/api-error-notice';

import { PolicyHitList } from './policy-hit-list';

/** Props for {@link PolicySearchResults}. */
export interface PolicySearchResultsProps {
  /** The text searched, or null when nothing was searched yet. */
  readonly text: string | null;
  /** The API's answer or its error. Null when nothing was searched. */
  readonly result: PolicySearchResponse | ApiError | null;
}

/**
 * Renders the outcome of a search. The region stays in the page so a screen reader announces
 * the change; an outage is shown as an error, never as "no results".
 *
 * @param props - The text searched and the outcome.
 * @returns The live region.
 */
export function PolicySearchResults({ text, result }: PolicySearchResultsProps): ReactElement {
  return (
    <div role="status" aria-live="polite" aria-atomic="false">
      {result === null || text === null ? null : 'hits' in result ? (
        result.hits.length === 0 ? (
          <p>
            No approved policy matched “{text}”. Try other words, or ask your advising office; you
            can open a case below.
          </p>
        ) : (
          <>
            <h2>
              {result.hits.length === 1
                ? '1 policy found'
                : `${String(result.hits.length)} policies found`}
            </h2>
            <PolicyHitList hits={result.hits} headingLevel={3} />
          </>
        )
      ) : (
        <ApiErrorNotice error={result} headingId="policy-search-outage-heading" />
      )}
    </div>
  );
}
