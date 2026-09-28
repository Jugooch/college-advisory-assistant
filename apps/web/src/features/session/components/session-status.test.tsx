/**
 * @file Tests for the session section.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ErrorCode } from '@caa/domain';

import { SessionStatus } from './session-status';

describe('SessionStatus', () => {
  it('says the user is not signed in on UNAUTHORIZED and links to dev sign-in when offered', () => {
    const html = renderToStaticMarkup(
      <SessionStatus
        session={{
          kind: 'error',
          error: { code: ErrorCode.Unauthorized, message: 'Sign in required.', requestId: null },
        }}
        devSignInHref="/dev/sign-in"
      />,
    );

    expect(html).toContain('You are not signed in.');
    expect(html).toContain('href="/dev/sign-in"');
  });

  it('shows no dev sign-in link when the build does not offer it', () => {
    const html = renderToStaticMarkup(
      <SessionStatus session={{ kind: 'unreachable' }} devSignInHref={null} />,
    );

    expect(html).toContain('the service didn’t respond');
    expect(html).not.toContain('<a');
  });

  it('shows any other API error as its notice with the API message', () => {
    const html = renderToStaticMarkup(
      <SessionStatus
        session={{
          kind: 'error',
          error: {
            code: ErrorCode.SourceUnavailable,
            message: 'Identity service is down.',
            requestId: 'req-syn-002',
          },
        }}
        devSignInHref={null}
      />,
    );

    expect(html).toContain('A source system is unavailable');
    expect(html).toContain('<p>Identity service is down.</p>');
  });
});
