/**
 * @file Tests for the synthetic user identity builder.
 */
import { describe, expect, it } from 'vitest';

import { IdentityStatus, Role, UserIdentitySchema } from '@caa/domain';

import { buildUserIdentity } from './user-identity.builder';

describe('buildUserIdentity', () => {
  it('defaults to an active student in tenant A', () => {
    expect(buildUserIdentity()).toEqual({
      id: '20000000-0000-4000-8000-000000000001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      issuer: 'https://idp.synthetic.example',
      subject: 'synthetic-subject-1',
      roles: ['STUDENT'],
      status: 'ACTIVE',
    });
  });

  it('returns deep-equal identities for the same arguments', () => {
    expect(buildUserIdentity({ roles: [Role.Advisor] }, 2)).toEqual(
      buildUserIdentity({ roles: [Role.Advisor] }, 2),
    );
  });

  it('derives the id and subject from the seed', () => {
    const identity = buildUserIdentity({}, 42);

    expect(identity.id).toBe('20000000-0000-4000-8000-00000000002a');
    expect(identity.subject).toBe('synthetic-subject-42');
  });

  it('applies overrides', () => {
    const identity = buildUserIdentity({
      tenantId: '10000000-0000-4000-8000-000000000002',
      roles: [Role.Advisor, Role.Admin],
      status: IdentityStatus.Disabled,
    });

    expect(identity.tenantId).toBe('10000000-0000-4000-8000-000000000002');
    expect(identity.roles).toEqual(['ADVISOR', 'ADMIN']);
    expect(identity.status).toBe('DISABLED');
  });

  it('returns an identity that passes the domain schema', () => {
    expect(UserIdentitySchema.safeParse(buildUserIdentity()).success).toBe(true);
  });

  it('rejects overrides the domain forbids', () => {
    expect(() => buildUserIdentity({ roles: [] })).toThrow();
  });
});
