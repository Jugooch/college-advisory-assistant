/**
 * @file HTTP-level tests for `GET /v1/me`, including every 401 path of the auth plugin.
 * @requirement FR-01
 */
import { describe, expect, it } from 'vitest';

import { ErrorCode, Role } from '@caa/domain';
import { SYNTHETIC_TENANTS } from '@caa/test-kit';

import { bearer, buildWorldApp, IDENTITIES, readError, TOKENS } from '../../testing/fixtures';

const { app } = buildWorldApp();

describe('GET /v1/me', () => {
  it('returns the actor resolved from the bearer token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: bearer(TOKENS.advisor),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        userId: IDENTITIES.advisor.id,
        tenantId: SYNTHETIC_TENANTS.a.id,
        roles: [Role.Advisor],
      },
    });
  });

  it('ignores tenant, user, and role supplied in the query or other headers', async () => {
    const query = `tenantId=${SYNTHETIC_TENANTS.b.id}&userId=${IDENTITIES.admin.id}&roles=ADMIN`;

    const response = await app.inject({
      method: 'GET',
      url: `/v1/me?${query}`,
      headers: {
        ...bearer(TOKENS.student),
        'x-tenant-id': SYNTHETIC_TENANTS.b.id,
        'x-role': 'ADMIN',
      },
    });

    expect(response.json()).toEqual({
      data: {
        userId: IDENTITIES.student.id,
        tenantId: SYNTHETIC_TENANTS.a.id,
        roles: [Role.Student],
      },
    });
  });

  it.each([
    ['no Authorization header', {}],
    ['a non-bearer scheme', { authorization: `Basic ${TOKENS.student}` }],
    ['an empty bearer token', { authorization: 'Bearer ' }],
    ['an unknown token', bearer('dev-token-unknown')],
    ['a disabled identity', bearer(TOKENS.disabled)],
  ])('returns the 401 UNAUTHORIZED envelope for %s', async (_case, headers) => {
    const response = await app.inject({ method: 'GET', url: '/v1/me', headers });

    expect(response.statusCode).toBe(401);
    expect(readError(response.json())).toEqual({
      code: ErrorCode.Unauthorized,
      message: 'Sign in to continue',
    });
  });
});
