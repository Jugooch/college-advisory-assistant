/**
 * @file The review queue as a table: reason, status, age, and whether the case is yours. Each
 * row's link names the case by its reason and when it was opened, never by a user ID.
 * @module @caa/web/features/advisor-cases/components/case-queue-table
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

import type { CaseQueueResponse } from '@caa/api-contract';

import { formatTimestamp } from '@/shared/utils/format-display';

import { describeCaseAge } from '../utils/case-age';
import { describeQueueStatus, describeReviewReason } from '../utils/review-wording';

/** One row of the queue, as the API returned it. */
type CaseQueueItem = CaseQueueResponse['cases'][number];

/** Shown beside the status of a case whose student has no active advisor assignment. */
export const UNROUTED_NOTE = 'No advisor is assigned to this student';

/** Props for {@link CaseQueueTable}. */
export interface CaseQueueTableProps {
  /** The rows exactly as the API returned them, oldest first. */
  readonly cases: readonly CaseQueueItem[];
  /** The current time, so each row's age is computed from one instant. */
  readonly now: Date;
}

/**
 * Builds the link text for one row so each link is distinct and says what it opens.
 *
 * @param item - The queue row.
 * @returns For example `Review "Review my plan", opened Sep 22, 2026, 3:00 PM UTC`.
 */
function describeReviewLink(item: CaseQueueItem): string {
  return `Review “${describeReviewReason(item.reason)}”, opened ${formatTimestamp(item.createdAt)}`;
}

/**
 * Renders one row.
 *
 * @param props - The queue row and the current time.
 * @param props.item - The queue row.
 * @param props.now - The current time.
 * @returns The table row.
 */
function QueueRow({
  item,
  now,
}: {
  readonly item: CaseQueueItem;
  readonly now: Date;
}): ReactElement {
  return (
    <tr>
      <th scope="row">{describeReviewReason(item.reason)}</th>
      <td>
        {describeQueueStatus(item.status)}
        {item.routed ? null : ` (${UNROUTED_NOTE})`}
      </td>
      <td>{describeCaseAge(item.createdAt, now)}</td>
      <td>{item.ownerIsYou ? 'Yours' : 'Not yours'}</td>
      <td>
        <Link href={`/advisor/cases/${item.caseId}`}>{describeReviewLink(item)}</Link>
      </td>
    </tr>
  );
}

/**
 * Renders the table. The caption says the order, since the API sorts oldest first and the web
 * doesn't sort again.
 *
 * @param props - The rows and the current time.
 * @returns The table.
 */
export function CaseQueueTable({ cases, now }: CaseQueueTableProps): ReactElement {
  return (
    <table>
      <caption>Cases to review, oldest first. Opened times are in UTC.</caption>
      <thead>
        <tr>
          <th scope="col">Reason</th>
          <th scope="col">Status</th>
          <th scope="col">Age</th>
          <th scope="col">Yours</th>
          <th scope="col">Open</th>
        </tr>
      </thead>
      <tbody>
        {cases.map((item) => (
          <QueueRow key={item.caseId} item={item} now={now} />
        ))}
      </tbody>
    </table>
  );
}
