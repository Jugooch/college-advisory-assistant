/**
 * @file Server action: removes the session cookie.
 * @module @caa/web/features/session/actions/dev-sign-out
 * @requirement FR-01
 * @see docs/standards/06-frontend.md
 */
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { clearSessionToken } from '@/lib/session-cookie';

/** Clears the session cookie and returns to the sign-in page. */
export async function devSignOutAction(): Promise<void> {
  clearSessionToken(await cookies());
  redirect('/dev/sign-in');
}
