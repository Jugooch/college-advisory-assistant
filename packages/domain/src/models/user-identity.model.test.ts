/**
 * @file Tests for the user identity data object.
 */
import { describe, expect, it } from 'vitest';

import { IdentityStatus } from '../enums/identity-status.enum';
import { Role } from '../enums/role.enum';
import {
  createUserIdentity,
  type UserIdentityInput,
  UserIdentitySchema,
} from './user-identity.model';

const VALID: UserIdentityInput = {
  id: '1a2b3c4d-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  issuer: 'https://sso.demo-state.example',
  subject: 'demo-subject-001',
  roles: [Role.Student],
  status: IdentityStatus.Active,
};

describe('createUserIdentity', () => {
  it('accepts a valid identity', () => {
    const identity = createUserIdentity(VALID);

    expect(identity).toEqual({
      id: '1a2b3c4d-0000-4000-8000-000000000001',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      issuer: 'https://sso.demo-state.example',
      subject: 'demo-subject-001',
      roles: ['STUDENT'],
      status: 'ACTIVE',
    });
  });

  it('accepts several distinct roles', () => {
    const identity = createUserIdentity({ ...VALID, roles: [Role.Advisor, Role.Admin] });

    expect(identity.roles).toEqual(['ADVISOR', 'ADMIN']);
  });

  it('accepts a disabled identity', () => {
    expect(createUserIdentity({ ...VALID, status: IdentityStatus.Disabled }).status).toBe(
      'DISABLED',
    );
  });

  it('rejects an empty role list', () => {
    expect(() => createUserIdentity({ ...VALID, roles: [] })).toThrow();
  });

  it('rejects duplicate roles', () => {
    expect(() => createUserIdentity({ ...VALID, roles: [Role.Advisor, Role.Advisor] })).toThrow(
      /duplicates/,
    );
  });

  it('rejects an empty issuer', () => {
    expect(() => createUserIdentity({ ...VALID, issuer: '' })).toThrow();
  });

  it('rejects an empty subject', () => {
    expect(() => createUserIdentity({ ...VALID, subject: '' })).toThrow();
  });

  it('rejects an id that is not a UUID', () => {
    expect(() => createUserIdentity({ ...VALID, id: 'user-1' })).toThrow();
  });

  it('rejects a tenantId that is not a UUID', () => {
    expect(() => createUserIdentity({ ...VALID, tenantId: 'demo-state' })).toThrow();
  });
});

describe('UserIdentitySchema', () => {
  it('rejects an unknown role', () => {
    expect(UserIdentitySchema.safeParse({ ...VALID, roles: ['SUPERUSER'] }).success).toBe(false);
  });

  it('rejects an unknown status', () => {
    expect(UserIdentitySchema.safeParse({ ...VALID, status: 'SUSPENDED' }).success).toBe(false);
  });

  it('rejects an identity keyed by email with no subject', () => {
    const { subject, ...rest } = VALID;
    const result = UserIdentitySchema.safeParse({
      ...rest,
      email: `${subject}@demo-state.example`,
    });

    expect(result.success).toBe(false);
  });
});
