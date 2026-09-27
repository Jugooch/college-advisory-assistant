/**
 * @file Tests for the session resolvers.
 * @requirement FR-01
 */
import { describe, expect, it } from 'vitest';

import { IdentityStatus, Role } from '@caa/domain';
import { buildUserIdentity, SYNTHETIC_TENANTS } from '@caa/test-kit';

import { createInMemoryRepositories } from '../../testing/in-memory-repositories';
import { createDenyAllSessionResolver, createDevSessionResolver } from './session.service';

const advisor = buildUserIdentity({ tenantId: SYNTHETIC_TENANTS.b.id, roles: [Role.Advisor] }, 2);
const disabled = buildUserIdentity({ status: IdentityStatus.Disabled }, 3);

const resolver = createDevSessionResolver({
  tokens: {
    'dev-token-advisor': { issuer: advisor.issuer, subject: advisor.subject },
    'dev-token-disabled': { issuer: disabled.issuer, subject: disabled.subject },
    'dev-token-missing': { issuer: advisor.issuer, subject: 'no-such-subject' },
  },
  identities: createInMemoryRepositories({
    identities: [advisor, disabled],
    students: [],
    assignments: [],
  }).userIdentities,
});

describe('createDevSessionResolver', () => {
  it('resolves a known token to the actor of its stored identity', async () => {
    const actor = await resolver.resolve('dev-token-advisor');

    expect(actor).toEqual({
      userId: advisor.id,
      tenantId: SYNTHETIC_TENANTS.b.id,
      roles: [Role.Advisor],
    });
  });

  it('rejects an unknown token', async () => {
    expect(await resolver.resolve('dev-token-unknown')).toBeNull();
  });

  it('rejects a token whose identity is disabled', async () => {
    expect(await resolver.resolve('dev-token-disabled')).toBeNull();
  });

  it('rejects a token whose identity does not exist', async () => {
    expect(await resolver.resolve('dev-token-missing')).toBeNull();
  });

  it('does not match inherited object properties as tokens', async () => {
    expect(await resolver.resolve('__proto__')).toBeNull();
    expect(await resolver.resolve('constructor')).toBeNull();
  });
});

describe('createDenyAllSessionResolver', () => {
  it('rejects every token', async () => {
    expect(await createDenyAllSessionResolver().resolve('dev-token-advisor')).toBeNull();
  });
});
