/**
 * @file The session cookie: its name, its security attributes, and reading the token from it.
 * @module @caa/web/lib/session-cookie
 * @requirement FR-01
 * @see docs/standards/09-errors-logging-and-security.md
 */

/** Name of the httpOnly cookie that carries the session token to the web server. */
export const SESSION_COOKIE_NAME = 'caa_session';

/** Session lifetime in seconds: one working day. */
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/** Security attributes of the session cookie. */
export interface SessionCookieOptions {
  readonly httpOnly: true;
  readonly sameSite: 'strict';
  readonly secure: boolean;
  readonly path: '/';
  /** Lifetime in seconds. */
  readonly maxAge: number;
}

/** The subset of Next's cookie store the session code reads and writes. */
export interface SessionCookieStore {
  /** Reads a cookie of the request. */
  get(name: string): { readonly value: string } | undefined;
  /** Writes a cookie to the response. */
  set(name: string, value: string, options: SessionCookieOptions): unknown;
  /** Removes a cookie in the response. */
  delete(name: string): unknown;
}

/**
 * Builds the session cookie's attributes.
 *
 * @param nodeEnv - The build's `NODE_ENV`.
 * @returns Attributes that keep the token away from page scripts and other sites.
 */
export function sessionCookieOptions(nodeEnv: string | undefined): SessionCookieOptions {
  // SECURITY: httpOnly keeps the token out of page scripts; strict same-site keeps other sites
  // from sending it. `secure` is off only outside production, where the app runs on localhost.
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: nodeEnv === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/**
 * Reads the session token from the cookie store.
 *
 * @param store - The request's cookie store.
 * @returns The token, or null when there is no non-empty session cookie.
 */
export function readSessionToken(store: Pick<SessionCookieStore, 'get'>): string | null {
  const value = store.get(SESSION_COOKIE_NAME)?.value ?? '';
  return value === '' ? null : value;
}
