/**
 * @file Server action: stores a dev token in the session cookie. Refused in production builds.
 * @module @caa/web/features/session/actions/dev-sign-in
 * @requirement FR-01
 * @see docs/standards/06-frontend.md
 */
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { writeSessionToken } from '@/lib/session-cookie';

import { DevSignInDisabledError, isDevSignInEnabled, parseDevToken } from '../utils/dev-sign-in';

/**
 * Stores the submitted dev token, then goes home, where `GET /v1/me` shows whether the API
 * accepted it. A malformed token returns to the form with an error.
 *
 * @param formData - The submitted sign-in form.
 * @throws {DevSignInDisabledError} In a production build. No cookie is written.
 */
export async function devSignInAction(formData: FormData): Promise<void> {
  // SECURITY: an action is a public POST endpoint, so it re-checks the production gate itself.
  if (!isDevSignInEnabled(process.env.NODE_ENV)) {
    throw new DevSignInDisabledError();
  }
  const token = parseDevToken(formData);
  if (token === null) {
    redirect('/dev/sign-in?error=invalid-token');
  }
  writeSessionToken(await cookies(), token, process.env.NODE_ENV);
  redirect('/');
}
