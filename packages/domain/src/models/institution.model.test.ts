/**
 * @file Tests for the institution data object.
 */
import { describe, expect, it } from 'vitest';

import { createInstitution, type InstitutionInput } from './institution.model';

const VALID: InstitutionInput = {
  id: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  name: 'Demo State University',
  timezone: 'America/Chicago',
  createdAt: '2026-09-25T12:00:00.000Z',
};

describe('createInstitution', () => {
  it('accepts a valid institution', () => {
    expect(createInstitution(VALID).name).toBe('Demo State University');
  });

  it('rejects an id that is not a UUID', () => {
    expect(() => createInstitution({ ...VALID, id: 'not-a-uuid' })).toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => createInstitution({ ...VALID, name: '' })).toThrow();
  });

  it('rejects a name longer than 200 characters', () => {
    expect(() => createInstitution({ ...VALID, name: 'a'.repeat(201) })).toThrow();
  });

  it('rejects an empty timezone', () => {
    expect(() => createInstitution({ ...VALID, timezone: '' })).toThrow();
  });

  it('rejects a createdAt that is not an ISO datetime', () => {
    expect(() => createInstitution({ ...VALID, createdAt: '25/09/2026' })).toThrow();
  });
});
