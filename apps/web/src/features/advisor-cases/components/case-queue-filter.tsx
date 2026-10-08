/**
 * @file The review queue's filter: a plain GET form with one select, so it works with the
 * keyboard and without scripting. Only admins are offered "Unrouted".
 * @module @caa/web/features/advisor-cases/components/case-queue-filter
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { ReactElement } from 'react';

import { CaseStatus } from '@caa/domain';

import {
  ALL_FILTER,
  QUEUE_FILTER_FIELD,
  type QueueFilter,
  toFilterValue,
  UNROUTED_FILTER,
} from '../utils/queue-filter';
import { describeQueueStatus } from '../utils/review-wording';

/** Props for {@link CaseQueueFilter}. */
export interface CaseQueueFilterProps {
  /** The filter in use, selected in the control. */
  readonly filter: QueueFilter;
  /** Whether to offer the admin-only "Unrouted" view. */
  readonly isAdmin: boolean;
}

/** The statuses a filter offers, in the order a case moves through them. */
const STATUS_OPTIONS = [
  CaseStatus.Open,
  CaseStatus.InReview,
  CaseStatus.Resolved,
  CaseStatus.Withdrawn,
] as const;

/**
 * Renders the filter form.
 *
 * @param props - The filter in use and whether the session is an admin's.
 * @returns The form.
 */
export function CaseQueueFilter({ filter, isAdmin }: CaseQueueFilterProps): ReactElement {
  return (
    <form method="get" role="search" aria-label="Filter the review queue">
      <label htmlFor="queue-filter">Show</label>{' '}
      <select id="queue-filter" name={QUEUE_FILTER_FIELD} defaultValue={toFilterValue(filter)}>
        <option value={ALL_FILTER}>All cases</option>
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {describeQueueStatus(status)}
          </option>
        ))}
        {isAdmin ? <option value={UNROUTED_FILTER}>Unrouted (no advisor assigned)</option> : null}
      </select>{' '}
      <button type="submit">Apply filter</button>
    </form>
  );
}
