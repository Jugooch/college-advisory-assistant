/**
 * @file Tests that API error envelopes are shown plainly, with the API's message unchanged.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ErrorCode } from '@caa/domain';

import { ApiErrorNotice } from './api-error-notice';

describe('ApiErrorNotice', () => {
  it('shows a SOURCE_UNAVAILABLE referral message as the API wrote it', () => {
    const html = renderToStaticMarkup(
      <ApiErrorNotice
        error={{
          code: ErrorCode.SourceUnavailable,
          message: 'The student record system is not responding. Contact your advisor.',
          requestId: 'req-syn-001',
        }}
      />,
    );

    expect(html).toContain('<h2 id="api-error-heading">A source system is unavailable</h2>');
    expect(html).toContain(
      '<p>The student record system is not responding. Contact your advisor.</p>',
    );
    expect(html).toContain('<code>req-syn-001</code>');
  });

  it('shows a STALE_SOURCE message without a support reference when none was sent', () => {
    const html = renderToStaticMarkup(
      <ApiErrorNotice
        error={{
          code: ErrorCode.StaleSource,
          message: 'Your record is being refreshed.',
          requestId: null,
        }}
      />,
    );

    expect(html).toContain('Your record is being refreshed</h2>');
    expect(html).toContain('<p>Your record is being refreshed.</p>');
    expect(html).not.toContain('Support reference');
  });
});
