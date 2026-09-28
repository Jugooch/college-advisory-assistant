/**
 * @file Error boundary for failures that aren't API error envelopes, such as a lost connection.
 * @module @caa/web/app/error
 * @requirement NFR-02
 */
'use client';

import type { ReactElement } from 'react';

/**
 * Renders a plain failure notice. Retrying is the student's choice; nothing retries silently.
 *
 * @param props - The error and Next's reset callback.
 * @returns The notice.
 */
export default function ErrorPage({
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}): ReactElement {
  return (
    <section className="notice notice--problem" aria-labelledby="error-heading">
      <h1 id="error-heading">The service didn’t respond</h1>
      <p>Nothing was changed. Try again, or contact your advisor if you need help now.</p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
