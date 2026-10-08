/**
 * @file Navigation for the advisor area. It is shown only on advisor screens and is offered only
 * to advisors and admins; the server still enforces access.
 * @module @caa/web/features/advisor-cases/components/advisor-nav
 * @requirement FR-12
 * @requirement NFR-02
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

/** Props for {@link AdvisorNav}. */
export interface AdvisorNavProps {
  /** Marks the queue link as the current page when the queue itself is shown. */
  readonly isQueueCurrent: boolean;
}

/**
 * Renders the advisor navigation landmark.
 *
 * @param props - Whether the queue is the current page.
 * @returns The nav element.
 */
export function AdvisorNav({ isQueueCurrent }: AdvisorNavProps): ReactElement {
  return (
    <nav aria-label="Advisor">
      <ul className="nav-list">
        <li>
          <Link href="/advisor/queue" aria-current={isQueueCurrent ? 'page' : undefined}>
            Review queue
          </Link>
        </li>
      </ul>
    </nav>
  );
}
