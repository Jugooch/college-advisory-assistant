/**
 * @file Home page: API status, who is signed in, and a way to open a student record. A student
 * whose sign-in is linked to a record goes straight to their own overview.
 * @module @caa/web/app/page
 * @requirement FR-01
 */
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { ApiError } from '@caa/api-contract';

import { getHealth } from '@/api/health.api';
import { getMe } from '@/api/session.api';
import { type SessionOutcome, SessionStatus } from '@/features/session/components/session-status';
import { StudentLookupForm } from '@/features/session/components/student-lookup-form';
import { isDevSignInOffered } from '@/features/session/utils/dev-sign-in';
import { ownOverviewPath } from '@/features/session/utils/own-record';
import { SystemStatusCard } from '@/features/system-status/components/system-status-card';

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
 * Renders the home page, or sends a signed-in student with a linked record to their overview.
 *
 * @returns The page element.
 */
export default async function HomePage(): Promise<ReactElement> {
  const [health, session] = await Promise.all([getHealth().catch(() => null), loadSession()]);
  const ownPath = session.kind === 'signed-in' ? ownOverviewPath(session.me) : null;
  if (ownPath !== null) {
    redirect(ownPath);
  }
  const isOffered = isDevSignInOffered(process.env.NODE_ENV, health?.authMode);
  const devSignInHref = isOffered ? '/dev/sign-in' : null;
  return (
    <>
      <h1>College Advisory Assistant</h1>
      <SessionStatus session={session} devSignInHref={devSignInHref} />
      {session.kind === 'signed-in' ? <StudentLookupForm idError={null} /> : null}
      <SystemStatusCard health={health} />
    </>
  );
}
