/**
 * @file Tests for the campus data object.
 */
import { describe, expect, it } from 'vitest';

import { type CampusInput, createCampus } from './campus.model';

const NORTH: CampusInput = {
  id: 'c4a1b2c3-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  sourceCampusId: 'N',
  name: 'North Campus',
};

describe('createCampus', () => {
  it('accepts a campus with a source ID and a display name', () => {
    expect(createCampus(NORTH)).toEqual({
      id: 'c4a1b2c3-0000-4000-8000-000000000001',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      sourceCampusId: 'N',
      name: 'North Campus',
    });
  });

  it('rejects an empty name or source ID', () => {
    expect(() => createCampus({ ...NORTH, name: '' })).toThrow();
    expect(() => createCampus({ ...NORTH, sourceCampusId: '' })).toThrow();
  });

  it('rejects a campus ID that is not a UUID', () => {
    expect(() => createCampus({ ...NORTH, id: 'N' })).toThrow();
  });
});
