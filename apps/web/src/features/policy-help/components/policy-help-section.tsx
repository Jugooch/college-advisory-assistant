/**
 * @file The policy help block of Help and cases: search form, results, and the where-to-ask list.
 * @module @caa/web/features/policy-help/components/policy-help-section
 * @requirement FR-16
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ReactElement } from 'react';

import type { ApiError, PolicySearchResponse } from '@caa/api-contract';

import type { PolicyQuery } from '../utils/policy-query';
import { PolicySearchForm } from './policy-search-form';
import { PolicySearchResults } from './policy-search-results';
import { WhereToAsk, type WhereToAskEntry } from './where-to-ask';

/** Props for {@link PolicyHelpSection}. */
export interface PolicyHelpSectionProps {
  /** Internal student ID, kept in the form so the page stays on the same student. */
  readonly studentId: string;
  /** What the URL asked to search for. */
  readonly search: PolicyQuery;
  /** The search outcome, or null when nothing was searched. */
  readonly searchResult: PolicySearchResponse | ApiError | null;
  /** One outcome per specialist topic, in display order. */
  readonly whereToAsk: readonly WhereToAskEntry[];
}

/**
 * Renders the block.
 *
 * @param props - The student, the query, and the outcomes.
 * @returns The block.
 */
export function PolicyHelpSection({
  studentId,
  search,
  searchResult,
  whereToAsk,
}: PolicyHelpSectionProps): ReactElement {
  return (
    <>
      <h2>Search school policies</h2>
      <PolicySearchForm
        studentId={studentId}
        text={search.kind === 'valid' ? search.text : ''}
        invalid={search.kind === 'invalid'}
      />
      <PolicySearchResults
        text={search.kind === 'valid' ? search.text : null}
        result={searchResult}
      />
      <WhereToAsk entries={whereToAsk} />
    </>
  );
}
