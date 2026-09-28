/**
 * @file Home page: API status, who is signed in, and a way to open a student record.
 * @module @caa/web/app/page
 * @requirement FR-01
 */
import type { ReactElement } from 'react';

import { ApiError } from '@caa/api-contract';

import { getHealth } from '@/api/health.api';
import { getMe } from '@/api/session.api';
import { type SessionOutcome, SessionStatus } from '@/features/session/components/session-status';
import { StudentLookupForm } from '@/features/session/components/student-lookup-form';
import { SystemStatusCard } from '@/features/system-status/components/system-status-card';
import { isDevSignInEnabled } from '@/lib/dev-sign-in';

/** Render on every request so the status is always current. */
export const dynamic = 'force-dynamic';

/**
 * Asks the API who is signed in.
 *
 * @returns The session outcome. An error envelope is kept; a failed connection is `unreachable`.
 */
async function loadSession(): Promise<SessionOutcome> {
  try {
    return { kind: 'signed-in', me: await getMe() };
  } catch (error) {
    return error instanceof ApiError ? { kind: 'error', error } : { kind: 'unreachable' };
  }
}

/**
 * Renders the home page.
 *
 * @returns The page element.
 */
export default async function HomePage(): Promise<ReactElement> {
  const [health, session] = await Promise.all([getHealth().catch(() => null), loadSession()]);
  const devSignInHref = isDevSignInEnabled(process.env.NODE_ENV) ? '/dev/sign-in' : null;
  return (
    <>
      <h1>College Advisory Assistant</h1>
      <SessionStatus session={session} devSignInHref={devSignInHref} />
      {session.kind === 'signed-in' ? <StudentLookupForm isMissingId={false} /> : null}
      <SystemStatusCard health={health} />
    </>
  );
}
