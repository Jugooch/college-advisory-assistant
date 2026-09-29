/**
 * @file Development sign-in decisions: whether the build offers it, and parsing the submitted
 * dev token. Pure; the actions wire these to the cookie store.
 * @module @caa/web/features/session/utils/dev-sign-in
 * @requirement FR-01
 * @see docs/standards/06-frontend.md
 */
import { z } from 'zod';

import { AuthMode } from '@caa/domain';

/** A dev token: one opaque word, as in `DEV_AUTH_TOKENS` in `infra/env.example`. */
export const DevTokenSchema = z.string().trim().min(1).max(256).regex(/^\S+$/);

/** Thrown when dev sign-in is attempted in a production build. */
export class DevSignInDisabledError extends Error {
  /** Creates the error. */
  constructor() {
    super('Development sign-in is not available in production builds');
    this.name = 'DevSignInDisabledError';
  }
}

/**
 * Returns whether dev sign-in may be offered or accepted.
 *
 * @param nodeEnv - The build's `NODE_ENV`.
 * @returns `true` in development and test builds, never in production.
 */
export function isDevSignInEnabled(nodeEnv: string | undefined): boolean {
  // SECURITY: dev tokens are guessable shortcuts; a production build never offers or accepts them.
  return nodeEnv !== 'production';
}

/**
 * Returns whether the web should offer dev sign-in: the build allows it and the API reports that
 * it accepts dev tokens.
 *
 * @param nodeEnv - The build's `NODE_ENV`.
 * @param authMode - The API's reported mode, or undefined when it wasn't reported or the API
 *   didn't respond.
 * @returns `true` only in a non-production build whose API reports `dev`.
 */
export function isDevSignInOffered(
  nodeEnv: string | undefined,
  authMode: AuthMode | undefined,
): boolean {
  // SECURITY: an unreported mode is unknown, never assumed to be `dev`.
  return isDevSignInEnabled(nodeEnv) && authMode === AuthMode.Dev;
}

/**
 * Reads the dev token from a submitted sign-in form.
 *
 * @param formData - The submitted form, with the token in its `token` field.
 * @returns The token, or null when the field is missing or malformed.
 */
export function parseDevToken(formData: FormData): string | null {
  const parsed = DevTokenSchema.safeParse(formData.get('token'));
  return parsed.success ? parsed.data : null;
}
