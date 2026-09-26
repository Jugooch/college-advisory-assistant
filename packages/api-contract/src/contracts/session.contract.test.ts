/**
 * @file Tests for the session contract.
 */
import { describe, expect, it } from 'vitest';

import { Role } from '@caa/domain';

import { getMeEndpoint, MeResponseSchema } from './session.contract';

const VALID = {
  userId: '1a2b3c4d-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  roles: [Role.Student],
};

describe('getMeEndpoint', () => {
  it('declares GET /v1/me', () => {
    expect(getMeEndpoint).toMatchObject({ method: 'GET', path: '/v1/me' });
  });
});

describe('MeResponseSchema', () => {
  it('accepts a user with a tenant and roles', () => {
    expect(MeResponseSchema.parse(VALID)).toEqual(VALID);
  });

  it('rejects an empty role list', () => {
    expect(MeResponseSchema.safeParse({ ...VALID, roles: [] }).success).toBe(false);
  });

  it('rejects an unknown role', () => {
    expect(MeResponseSchema.safeParse({ ...VALID, roles: ['SUPERUSER'] }).success).toBe(false);
  });

  it('rejects a non-UUID userId', () => {
    expect(MeResponseSchema.safeParse({ ...VALID, userId: 'user-1' }).success).toBe(false);
  });

  it('rejects a missing tenantId', () => {
    const withoutTenant = { userId: VALID.userId, roles: VALID.roles };

    expect(MeResponseSchema.safeParse(withoutTenant).success).toBe(false);
  });
});
