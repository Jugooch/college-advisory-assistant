/**
 * @file Tests for the user identity row mapper.
 */
import { describe, expect, it } from 'vitest';

import { IdentityStatus, Role } from '@caa/domain';

import type { UserIdentityRow } from '../tables/user-identity.table';
import { toUserIdentity } from './user-identity.mapper';

const ROW: UserIdentityRow = {
  id: '5d1c2b3a-4f5e-4d6c-8b7a-1a2b3c4d5e6f',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  issuer: 'https://idp.demo-state.example',
  subject: 'synthetic-subject-001',
  roles: [Role.Advisor, Role.Admin],
  status: IdentityStatus.Active,
  createdAt: new Date('2026-09-25T12:00:00.000Z'),
};

describe('toUserIdentity', () => {
  it('round-trips the stored roles and status', () => {
    const identity = toUserIdentity(ROW);

    expect(identity.roles).toEqual([Role.Advisor, Role.Admin]);
    expect(identity.status).toBe(IdentityStatus.Active);
    expect(identity.subject).toBe('synthetic-subject-001');
  });

  it('rejects a stored row with no roles', () => {
    expect(() => toUserIdentity({ ...ROW, roles: [] })).toThrow();
  });
});
