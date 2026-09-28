/**
 * @file Development-only sign-in: stores a dev token from `infra/env.example` in the session
 * cookie. Refused in production builds.
 * @module @caa/web/lib/dev-sign-in
 * @requirement FR-01
 * @see docs/standards/09-errors-logging-and-security.md
 */
import { z } from 'zod';

import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  type SessionCookieStore,
} from './session-cookie';

/** A dev token: one opaque word, as in `DEV_AUTH_TOKENS`. */
const DevTokenSchema = z.string().trim().min(1).max(256).regex(/^\S+$/);

/** Thrown when dev sign-in is attempted in a production build. */
export class DevSignInDisabledError extends Error {
  /** Creates the error. */
  constructor() {
    super('Development sign-in is not available in production builds');
    this.name = 'DevSignInDisabledError';
  }
}

/** Dependencies of the dev sign-in actions. */
export interface DevSignInDependencies {
  /** The build's `NODE_ENV`. */
  readonly nodeEnv: string | undefined;
  readonly cookieStore: SessionCookieStore;
}

/** Result of a sign-in attempt. */
export type DevSignInResult = 'SIGNED_IN' | 'INVALID_TOKEN';

/**
 * Returns whether dev sign-in may be offered.
 *
 * @param nodeEnv - The build's `NODE_ENV`.
 * @returns `true` in development and test builds, never in production.
 */
export function isDevSignInEnabled(nodeEnv: string | undefined): boolean {
  // SECURITY: dev tokens are guessable shortcuts; a production build never offers or accepts them.
  return nodeEnv !== 'production';
}

/**
 * Stores a dev token from a submitted form in the session cookie. The API still decides whether
 * the token signs anyone in: an unknown token is refused by every protected endpoint.
 *
 * @param formData - The submitted form, with the token in its `token` field.
 * @param dependencies - Build environment and cookie store.
 * @returns `INVALID_TOKEN` when the field is missing or malformed, otherwise `SIGNED_IN`.
 * @throws {DevSignInDisabledError} In a production build. No cookie is written.
 */
export function signInWithDevToken(
  formData: FormData,
  dependencies: DevSignInDependencies,
): DevSignInResult {
  if (!isDevSignInEnabled(dependencies.nodeEnv)) {
    throw new DevSignInDisabledError();
  }
  const parsed = DevTokenSchema.safeParse(formData.get('token'));
  if (!parsed.success) {
    return 'INVALID_TOKEN';
  }
  dependencies.cookieStore.set(
    SESSION_COOKIE_NAME,
    parsed.data,
    sessionCookieOptions(dependencies.nodeEnv),
  );
  return 'SIGNED_IN';
}

/**
 * Removes the session cookie.
 *
 * @param cookieStore - The request's cookie store.
 */
export function signOut(cookieStore: Pick<SessionCookieStore, 'delete'>): void {
  cookieStore.delete(SESSION_COOKIE_NAME);
}
