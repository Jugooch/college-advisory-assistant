/**
 * @file How the API authenticates requests, as reported to clients.
 * @module @caa/domain/enums/auth-mode
 * @requirement FR-01
 * @requirement NFR-02
 * @see docs/planning/07-system-architecture-and-design.md
 */
import { z } from 'zod';

/**
 * Authentication mode the API runs in.
 *
 * - `none`: every protected request is denied until SSO is added.
 * - `dev`: opaque dev tokens sign in as seeded synthetic identities. Never allowed in
 *   production. The web offers dev sign-in only when the API reports this mode.
 */
export const AuthMode = {
  None: 'none',
  Dev: 'dev',
} as const;

/** Union of every {@link AuthMode} value. */
export type AuthMode = (typeof AuthMode)[keyof typeof AuthMode];

/** Runtime schema for {@link AuthMode}. */
export const AuthModeSchema = z.enum(AuthMode);
