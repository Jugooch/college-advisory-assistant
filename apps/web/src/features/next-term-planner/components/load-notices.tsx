/**
 * @file Error notices for the planner page's lookups; the form still renders beside them.
 * @module @caa/web/features/next-term-planner/components/load-notices
 * @requirement FR-08
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import {
  type AcademicSummaryResponse,
  ApiError,
  type PlannableTermsResponse,
} from '@caa/api-contract';

import { ApiErrorNotice } from '@/shared/components/api-error-notice';

/** Props for {@link LoadNotices}. */
export interface LoadNoticesProps {
  /** The summary, or the error its lookup returned. */
  readonly summary: AcademicSummaryResponse | ApiError;
  /** The plannable terms, or the error their lookup returned. */
  readonly terms: PlannableTermsResponse | ApiError;
}

/**
 * Shows an error notice for each lookup that failed.
 *
 * @param props - The summary and terms outcomes.
 * @returns The notices.
 */
export function LoadNotices({ summary, terms }: LoadNoticesProps): ReactElement {
  return (
    <>
      {summary instanceof ApiError ? (
        <ApiErrorNotice error={summary} headingId="summary-error-heading" />
      ) : null}
      {terms instanceof ApiError ? (
        <ApiErrorNotice error={terms} headingId="terms-error-heading" />
      ) : null}
    </>
  );
}
