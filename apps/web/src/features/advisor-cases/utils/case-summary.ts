/**
 * @file The type of one row in the student's case list, derived from the list response.
 * @module @caa/web/features/advisor-cases/utils/case-summary
 * @requirement FR-12
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { CaseListResponse } from '@caa/api-contract';

/** One row of the student's case list: reason, status, and time, with no note text. */
export type CaseSummary = CaseListResponse['cases'][number];
