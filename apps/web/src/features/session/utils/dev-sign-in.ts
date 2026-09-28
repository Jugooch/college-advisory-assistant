/**
 * @file Development sign-in decisions: whether the build offers it, and parsing the submitted
 * dev token. Pure; the actions wire these to the cookie store.
 * @module @caa/web/features/session/utils/dev-sign-in
 * @requirement FR-01
 * @see docs/standards/06-frontend.md
 */
import { z } from 'zod';

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
 * Reads the dev token from a submitted sign-in form.
 *
 * @param formData - The submitted form, with the token in its `token` field.
 * @returns The token, or null when the field is missing or malformed.
 */
export function parseDevToken(formData: FormData): string | null {
  const parsed = DevTokenSchema.safeParse(formData.get('token'));
  return parsed.success ? parsed.data : null;
}
