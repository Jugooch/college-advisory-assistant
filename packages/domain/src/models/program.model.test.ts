/**
 * @file Tests for the program identity and data object.
 */
import { describe, expect, it } from 'vitest';

import { createProgram, ProgramIdSchema, type ProgramInput } from './program.model';

const PHYSICS: ProgramInput = {
  id: '708192a3-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  sourceProgramId: 'DEMO-BS-PHYS',
  name: 'B.S. Demo Physics',
};

describe('ProgramIdSchema', () => {
  it('accepts a UUID', () => {
    expect(ProgramIdSchema.parse('708192a3-0000-4000-8000-000000000001')).toBe(
      '708192a3-0000-4000-8000-000000000001',
    );
  });

  it('rejects a source program code, because internal IDs are UUIDs', () => {
    expect(ProgramIdSchema.safeParse('BS-MATH').success).toBe(false);
  });
});

describe('createProgram', () => {
  it('accepts a program with a source ID and a catalog name', () => {
    expect(createProgram(PHYSICS)).toEqual({
      id: '708192a3-0000-4000-8000-000000000001',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      sourceProgramId: 'DEMO-BS-PHYS',
      name: 'B.S. Demo Physics',
    });
  });

  it('accepts a null name, meaning the catalog supplies none', () => {
    expect(createProgram({ ...PHYSICS, name: null }).name).toBeNull();
  });

  it('rejects an empty name, because unknown is an explicit null', () => {
    expect(() => createProgram({ ...PHYSICS, name: '' })).toThrow();
  });

  it('rejects an empty sourceProgramId', () => {
    expect(() => createProgram({ ...PHYSICS, sourceProgramId: '' })).toThrow();
  });
});
