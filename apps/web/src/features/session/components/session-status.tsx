/**
 * @file Shows who the API resolved the session to, or why nobody is signed in.
 * @module @caa/web/features/session/components/session-status
 * @requirement FR-01
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

import type { ApiError, MeResponse } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';

import { ApiErrorNotice } from '@/shared/components/api-error-notice';
import { canReviewCases } from '@/shared/utils/session-roles';

/** The outcome of asking the API who is signed in. */
export type SessionOutcome =
  | { readonly kind: 'signed-in'; readonly me: MeResponse }
  | { readonly kind: 'error'; readonly error: Pick<ApiError, 'code' | 'message' | 'requestId'> }
  | { readonly kind: 'unreachable' };

/** Props for {@link SessionStatus}. */
export interface SessionStatusProps {
  readonly session: SessionOutcome;
  /** Link to the development sign-in page, or null when this build doesn't offer it. */
  readonly devSignInHref: string | null;
}

/**
 * Renders the session section.
 *
 * @param props - The session outcome and the dev sign-in link.
 * @returns The session section.
 */
export function SessionStatus({ session, devSignInHref }: SessionStatusProps): ReactElement {
  const signInLink =
    devSignInHref === null ? null : (
      <p>
        <Link href={devSignInHref}>Development sign-in</Link>
      </p>
    );
  if (session.kind === 'error' && session.error.code !== ErrorCode.Unauthorized) {
    return <ApiErrorNotice error={session.error} />;
  }
  return (
    <section aria-labelledby="session-heading">
      <h2 id="session-heading">Your session</h2>
      {session.kind === 'signed-in' ? (
        <p>
          Signed in as user <code>{session.me.userId}</code> with roles:{' '}
          {session.me.roles.join(', ').toLowerCase()}.
        </p>
      ) : (
        <p>
          {session.kind === 'unreachable'
            ? 'Your sign-in couldn’t be checked because the service didn’t respond.'
            : 'You are not signed in.'}
        </p>
      )}
      {session.kind === 'signed-in' && canReviewCases(session.me.roles) ? (
        <p>
          <Link href="/advisor/queue">Open the review queue</Link>
        </p>
      ) : null}
      {signInLink}
    </section>
  );
}
