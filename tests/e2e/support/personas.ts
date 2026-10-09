/**
 * @file The one list of synthetic dev personas the e2e tests use: the opaque dev token and the
 *   SSO identity the API maps it to. The Playwright config builds `DEV_AUTH_TOKENS` from it and
 *   `signInAs` types its argument from it, so a persona is added in one place. The values mirror
 *   `DEV_AUTH_TOKENS` in `infra/env.example`.
 * @module @caa/tests/e2e/support/personas
 * @requirement T08
 * @requirement FR-01
 */

/** The synthetic identity provider every persona signs in through. */
const SYNTHETIC_ISSUER = 'https://idp.synthetic.example';

/** A persona's dev token and the identity the API resolves it to. */
export interface DevPersonaIdentity {
  /** The opaque bearer token submitted on `/dev/sign-in`. */
  readonly token: string;
  readonly issuer: string;
  readonly subject: string;
}

/** The personas by name. */
export const DEV_PERSONAS = {
  admin: { token: 'dev-token-admin', issuer: SYNTHETIC_ISSUER, subject: 'synthetic-admin-001' },
  advisor: {
    token: 'dev-token-advisor',
    issuer: SYNTHETIC_ISSUER,
    subject: 'synthetic-advisor-001',
  },
  advisorTwo: {
    token: 'dev-token-advisor-2',
    issuer: SYNTHETIC_ISSUER,
    subject: 'synthetic-advisor-002',
  },
  student: {
    token: 'dev-token-student',
    issuer: SYNTHETIC_ISSUER,
    subject: 'synthetic-student-001',
  },
} as const satisfies Record<string, DevPersonaIdentity>;

/** A persona name. */
export type DevPersona = keyof typeof DEV_PERSONAS;

/**
 * Builds the `DEV_AUTH_TOKENS` value the API reads when `AUTH_MODE=dev`.
 *
 * @returns A JSON object mapping each token to its `{ issuer, subject }`.
 */
export function devAuthTokensJson(): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.values(DEV_PERSONAS).map(({ token, issuer, subject }) => [token, { issuer, subject }]),
    ),
  );
}
