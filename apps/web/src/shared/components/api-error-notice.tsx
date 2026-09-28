/**
 * @file Shows an API error envelope plainly: a fixed heading, the API's own message, a next step,
 * and the support reference.
 * @module @caa/web/shared/components/api-error-notice
 * @requirement NFR-02
 * @see docs/planning/05-product-requirements.md
 */
import type { ReactElement } from 'react';

import type { ApiError } from '@caa/api-contract';

import { describeError } from '@/shared/utils/error-code-wording';

/** Props for {@link ApiErrorNotice}. */
export interface ApiErrorNoticeProps {
  /** The error the API returned. Its message is safe to show and is shown unchanged. */
  readonly error: Pick<ApiError, 'code' | 'message' | 'requestId'>;
  /** Id of the notice heading. Give each notice on one page its own. */
  readonly headingId?: string;
}

/**
 * Renders an API error without turning it into a generic failure. Nothing is retried for the
 * student; any retry is theirs to start.
 *
 * @param props - The API error and its heading id.
 * @returns The notice section.
 */
export function ApiErrorNotice({
  error,
  headingId = 'api-error-heading',
}: ApiErrorNoticeProps): ReactElement {
  const wording = describeError(error.code);
  return (
    <section className="notice notice--problem" aria-labelledby={headingId}>
      <h2 id={headingId}>{wording.heading}</h2>
      <p>{error.message}</p>
      <p>{wording.nextStep}</p>
      {error.requestId === null ? null : (
        <p>
          Support reference: <code>{error.requestId}</code>
        </p>
      )}
    </section>
  );
}
