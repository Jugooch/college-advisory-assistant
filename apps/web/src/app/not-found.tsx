/**
 * @file Not-found page for unknown routes, plans, and cases.
 * @module @caa/web/app/not-found
 * @requirement NFR-02
 * @see docs/planning/12-security-privacy-and-data-governance.md
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

/**
 * Says the page isn't available and offers two ways forward. The copy never says whether the item
 * exists for someone else.
 *
 * @returns The notice.
 */
export default function NotFound(): ReactElement {
  return (
    <section aria-labelledby="not-found-heading">
      <h1 id="not-found-heading">We couldn’t find that page</h1>
      <p>The link may be wrong or out of date. Nothing was changed.</p>
      <ul>
        <li>
          <Link href="/overview">Go to Overview</Link>
        </li>
        <li>
          <Link href="/help-and-cases">Go to Help and cases</Link>
        </li>
      </ul>
    </section>
  );
}
