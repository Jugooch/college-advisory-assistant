/**
 * @file The review queue's filter: read from the page's query, shown in the filter form, and
 * turned into the API's query. Only the admin may choose "Unrouted".
 * @module @caa/web/features/advisor-cases/utils/queue-filter
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { CaseQueueQuery } from '@caa/api-contract';
import { type CaseStatus, CaseStatusSchema } from '@caa/domain';

/** The query parameter and form field that carry the filter. */
export const QUEUE_FILTER_FIELD = 'filter';

/** The filter value for the admin-only unrouted view. */
export const UNROUTED_FILTER = 'unrouted';

/** The filter value for every case. */
export const ALL_FILTER = 'all';

/** What the queue is filtered by. */
export type QueueFilter =
  | { readonly kind: 'all' }
  | { readonly kind: 'status'; readonly status: CaseStatus }
  | { readonly kind: 'unrouted' };

/**
 * Reads the filter from the page's query.
 *
 * @param value - The raw `filter` query value.
 * @param isAdmin - Whether the session is an admin's. Anyone else asking for the unrouted view
 *   gets every case, since the API would refuse the filter.
 * @returns The filter. A missing, repeated, or unknown value means every case.
 */
export function readQueueFilter(
  value: string | readonly string[] | undefined,
  isAdmin: boolean,
): QueueFilter {
  if (typeof value !== 'string') {
    return { kind: 'all' };
  }
  if (value === UNROUTED_FILTER) {
    return isAdmin ? { kind: 'unrouted' } : { kind: 'all' };
  }
  const status = CaseStatusSchema.safeParse(value);
  return status.success ? { kind: 'status', status: status.data } : { kind: 'all' };
}

/**
 * Turns a filter into the API's query.
 *
 * @param filter - The filter.
 * @returns The status or unrouted flag the API understands; nothing for every case.
 */
export function toQueueQuery(filter: QueueFilter): CaseQueueQuery {
  switch (filter.kind) {
    case 'all':
      return {};
    case 'status':
      return { status: filter.status };
    case 'unrouted':
      return { unrouted: true };
  }
}

/**
 * Gives the filter's form value, so the select shows the filter in use.
 *
 * @param filter - The filter.
 * @returns `all`, a status, or `unrouted`.
 */
export function toFilterValue(filter: QueueFilter): string {
  switch (filter.kind) {
    case 'all':
      return ALL_FILTER;
    case 'status':
      return filter.status;
    case 'unrouted':
      return UNROUTED_FILTER;
  }
}
