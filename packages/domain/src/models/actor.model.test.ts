/**
 * @file Tests for the actor data object.
 */
import { describe, expect, it } from 'vitest';

import { Role } from '../enums/role.enum';
import { type ActorInput, ActorSchema, createActor } from './actor.model';

const VALID: ActorInput = {
  userId: '1a2b3c4d-0000-4000-8000-000000000002',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  roles: [Role.Advisor],
};

describe('createActor', () => {
  it('accepts a valid actor', () => {
    expect(createActor(VALID)).toEqual({
      userId: '1a2b3c4d-0000-4000-8000-000000000002',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      roles: ['ADVISOR'],
    });
  });

  it('rejects an empty role list', () => {
    expect(() => createActor({ ...VALID, roles: [] })).toThrow();
  });

  it('rejects duplicate roles', () => {
    expect(() => createActor({ ...VALID, roles: [Role.Student, Role.Student] })).toThrow(
      /duplicates/,
    );
  });

  it('rejects a userId that is not a UUID', () => {
    expect(() => createActor({ ...VALID, userId: 'advisor-1' })).toThrow();
  });
});

describe('ActorSchema', () => {
  it('rejects an actor without a tenantId', () => {
    const result = ActorSchema.safeParse({
      userId: '1a2b3c4d-0000-4000-8000-000000000002',
      roles: ['ADVISOR'],
    });

    expect(result.success).toBe(false);
  });
});
