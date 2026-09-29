/**
 * @file HTTP-level tests for `GET /v1/me`, including every 401 path of the auth plugin and the
 * linked student ID of each kind of session.
 * @requirement FR-01
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ErrorCode, Role } from '@caa/domain';
import { buildStudent, SYNTHETIC_TENANTS } from '@caa/test-kit';

import {
  bearer,
  buildWorldApp,
  IDENTITIES,
  readError,
  STUDENTS,
  TOKENS,
} from '../../testing/fixtures';

const { app, store } = buildWorldApp();

beforeEach(() => {
  store.students = Object.values(STUDENTS);
});

/**
 * Reads `/v1/me` with a dev token.
 *
 * @param token - Dev token.
 * @returns The linked student ID in the response.
 */
async function studentIdFor(token: string): Promise<unknown> {
  const response = await app.inject({ method: 'GET', url: '/v1/me', headers: bearer(token) });
  return z.object({ data: z.looseObject({ studentId: z.unknown() }) }).parse(response.json()).data
    .studentId;
}

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
        studentId: null,
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
        studentId: STUDENTS.own.id,
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

describe('GET /v1/me studentId', () => {
  it('is the linked student for a student session', async () => {
    expect(await studentIdFor(TOKENS.student)).toBe(STUDENTS.own.id);
  });

  it.each([
    ['an advisor', TOKENS.advisor],
    ['an admin of the same tenant', TOKENS.tenantAdmin],
    ['an admin of another tenant', TOKENS.admin],
  ])('is null for %s', async (_case, token) => {
    expect(await studentIdFor(token)).toBeNull();
  });

  it('is null for a student session with no linked record', async () => {
    store.students = [STUDENTS.other];

    expect(await studentIdFor(TOKENS.student)).toBeNull();
  });

  it("is null when the user's only link is a student in another tenant", async () => {
    const foreign = buildStudent(
      { tenantId: SYNTHETIC_TENANTS.b.id, userId: IDENTITIES.student.id },
      9,
    );
    store.students = [STUDENTS.other, foreign];

    expect(await studentIdFor(TOKENS.student)).toBeNull();
  });
});
