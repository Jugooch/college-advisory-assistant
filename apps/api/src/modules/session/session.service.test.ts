/**
 * @file Tests for the session resolvers and the session service behind `GET /v1/me`.
 * @requirement FR-01
 */
import { describe, expect, it } from 'vitest';

import type { StudentUserLinkRepository } from '@caa/db';
import { IdentityStatus, Role, type Student } from '@caa/domain';
import { buildActor, buildStudent, buildUserIdentity, SYNTHETIC_TENANTS } from '@caa/test-kit';

import { createInMemoryRepositories } from '../../testing/in-memory-repositories';
import {
  createDenyAllSessionResolver,
  createDevSessionResolver,
  createSessionService,
} from './session.service';

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

/**
 * Creates the session service over a fake link repository that records its lookups.
 *
 * @param linked - What the fake returns for any lookup.
 * @returns The service and the recorded lookups.
 */
function sessionOver(linked: Student | null) {
  const lookups: unknown[] = [];
  const studentUserLinks: StudentUserLinkRepository = {
    findByUserId: (...args) => {
      lookups.push(args);
      return Promise.resolve(linked);
    },
  };
  return { service: createSessionService({ studentUserLinks }), lookups };
}

describe('createSessionService', () => {
  const student = buildActor({ roles: [Role.Student] });
  const own = buildStudent({ userId: student.userId }, 1);

  it("gives a student session its linked student's ID, looked up for the session", async () => {
    const { service, lookups } = sessionOver(own);

    expect(await service.describe(student)).toEqual({ ...student, studentId: own.id });
    expect(lookups).toEqual([[student.tenantId, student.userId]]);
  });

  it('gives a student with no linked record null', async () => {
    expect((await sessionOver(null).service.describe(student)).studentId).toBeNull();
  });

  it.each([
    ['an advisor', Role.Advisor],
    ['an admin', Role.Admin],
  ])('gives %s null without looking a link up', async (_case, role) => {
    const { service, lookups } = sessionOver(own);

    expect((await service.describe(buildActor({ roles: [role] }))).studentId).toBeNull();
    expect(lookups).toEqual([]);
  });

  it("never shows another tenant's student, even if the repository returns one", async () => {
    const foreign = buildStudent({ tenantId: SYNTHETIC_TENANTS.b.id, userId: student.userId }, 9);

    expect((await sessionOver(foreign).service.describe(student)).studentId).toBeNull();
  });

  it('fails, choosing no student, when the link is ambiguous', async () => {
    const service = createSessionService({
      studentUserLinks: createInMemoryRepositories({
        identities: [],
        students: [own, buildStudent({ userId: student.userId }, 2)],
        assignments: [],
      }).studentUserLinks,
    });

    await expect(service.describe(student)).rejects.toThrow('More than one student');
  });
});
