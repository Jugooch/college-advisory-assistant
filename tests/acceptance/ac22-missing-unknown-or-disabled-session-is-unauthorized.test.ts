/**
 * @file Acceptance: a request with no session, an unknown session, or a disabled identity's
 * session gets 401 with the standard error envelope and no data.
 * @requirement FR-01
 * @requirement T01
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/standards/05-api-design.md
 */
import { describe, expect, it } from 'vitest';

import { IdentityStatus, Role } from '@caa/domain';
import { buildStudent, buildUserIdentity } from '@caa/test-kit';

import { buildAcceptanceApp, getAs, summarizeError } from '../support/api-harness';

const OWN_STUDENT_IDENTITY = buildUserIdentity({ roles: [Role.Student] }, 31);
const DISABLED_ADMIN = buildUserIdentity(
  { roles: [Role.Admin], status: IdentityStatus.Disabled },
  32,
);
const UNPROVISIONED = buildUserIdentity({ roles: [Role.Admin] }, 33);
const STUDENT = buildStudent({ userId: OWN_STUDENT_IDENTITY.id }, 31);
const STUDENT_URL = '/v1/students/30000000-0000-4000-8000-00000000001f';

const app = buildAcceptanceApp(
  { identities: [OWN_STUDENT_IDENTITY, DISABLED_ADMIN], students: [STUDENT], assignments: [] },
  [
    { token: 'ac22-active', identity: OWN_STUDENT_IDENTITY },
    { token: 'ac22-disabled', identity: DISABLED_ADMIN },
    // NOTE: a known token whose identity was never provisioned in the tenant.
    { token: 'ac22-unprovisioned', identity: UNPROVISIONED },
  ],
);

const UNAUTHORIZED = {
  statusCode: 401,
  bodyKeys: ['error'],
  errorKeys: ['code', 'message', 'requestId'],
  code: 'UNAUTHORIZED',
};

describe('AC22 requests without a valid session', () => {
  it('lets an active identity read its own record, so the 401s below are about the session', async () => {
    const response = await getAs(app, STUDENT_URL, 'Bearer ac22-active');

    expect(response.statusCode).toBe(200);
  });

  it.each([
    ['no Authorization header', null],
    ['an empty bearer token', 'Bearer '],
    ['a non-bearer scheme', 'Basic YWMyMjphYzIy'],
    ['an unknown bearer token', 'Bearer ac22-never-issued'],
    ['a token for an identity that was never provisioned', 'Bearer ac22-unprovisioned'],
    ['a disabled identity', 'Bearer ac22-disabled'],
  ])('returns the 401 envelope for %s on a student read', async (_case, authorization) => {
    const response = await getAs(app, STUDENT_URL, authorization);

    expect(summarizeError(response)).toMatchObject(UNAUTHORIZED);
  });

  it.each([
    ['no Authorization header', null],
    ['an unknown bearer token', 'Bearer ac22-never-issued'],
    ['a disabled identity', 'Bearer ac22-disabled'],
  ])('returns the 401 envelope for %s on /v1/me', async (_case, authorization) => {
    const response = await getAs(app, '/v1/me', authorization);

    expect(summarizeError(response)).toMatchObject(UNAUTHORIZED);
  });
});
