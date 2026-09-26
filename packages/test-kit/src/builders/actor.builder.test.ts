/**
 * @file Tests for the synthetic actor builder.
 */
import { describe, expect, it } from 'vitest';

import { ActorSchema, Role } from '@caa/domain';

import { buildActor } from './actor.builder';

describe('buildActor', () => {
  it('defaults to a student in tenant A', () => {
    expect(buildActor()).toEqual({
      userId: '20000000-0000-4000-8000-000000000001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      roles: ['STUDENT'],
    });
  });

  it('returns deep-equal actors for the same arguments', () => {
    expect(buildActor({ roles: [Role.Advisor] }, 2)).toEqual(
      buildActor({ roles: [Role.Advisor] }, 2),
    );
  });

  it('derives the userId from the seed', () => {
    expect(buildActor({}, 2).userId).toBe('20000000-0000-4000-8000-000000000002');
  });

  it('applies overrides', () => {
    const actor = buildActor({
      tenantId: '10000000-0000-4000-8000-000000000002',
      roles: [Role.Admin],
    });

    expect(actor.tenantId).toBe('10000000-0000-4000-8000-000000000002');
    expect(actor.roles).toEqual(['ADMIN']);
  });

  it('returns an actor that passes the domain schema', () => {
    expect(ActorSchema.safeParse(buildActor()).success).toBe(true);
  });

  it('rejects overrides the domain forbids', () => {
    expect(() => buildActor({ roles: [Role.Student, Role.Student] })).toThrow();
  });
});
