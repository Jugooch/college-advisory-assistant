/**
 * @file Tests for the session section.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MeResponseSchema } from '@caa/api-contract';
import { ErrorCode, Role } from '@caa/domain';
import { SYNTHETIC_TENANTS, syntheticId } from '@caa/test-kit';

import { SessionStatus } from './session-status';

const ME = MeResponseSchema.parse({
  userId: syntheticId('user', 1),
  tenantId: SYNTHETIC_TENANTS.a.id,
  roles: [Role.Student],
  studentId: null,
});

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

  it.each([[Role.Advisor], [Role.Admin]])('links a %s to the review queue', (role) => {
    const html = renderToStaticMarkup(
      <SessionStatus
        session={{ kind: 'signed-in', me: { ...ME, roles: [role] } }}
        devSignInHref={null}
      />,
    );

    expect(html).toContain('href="/advisor/queue"');
    expect(html).toContain('Open the review queue');
  });

  it('does not show the review queue link to a student', () => {
    const html = renderToStaticMarkup(
      <SessionStatus
        session={{ kind: 'signed-in', me: { ...ME, roles: [Role.Student] } }}
        devSignInHref={null}
      />,
    );

    expect(html).not.toContain('/advisor/queue');
  });
});
