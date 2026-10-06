/**
 * @file Tests for the program row mapper.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type { ProgramRow } from '../tables/program.table';
import { toProgram } from './program.mapper';

const ROW: ProgramRow = {
  id: '3c4d5e6f-7081-4a92-8b3c-4d5e6f708192',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  sourceProgramId: 'DEMO-BS-PHYS',
  name: 'Demo B.S. Physics',
  createdAt: new Date('2026-09-25T12:00:00.000Z'),
};

describe('toProgram', () => {
  it('keeps only the domain fields', () => {
    expect(toProgram(ROW)).toEqual({
      id: ROW.id,
      tenantId: ROW.tenantId,
      sourceProgramId: 'DEMO-BS-PHYS',
      name: 'Demo B.S. Physics',
    });
  });

  it('keeps a null name as null, meaning the catalog supplies none', () => {
    expect(toProgram({ ...ROW, name: null }).name).toBeNull();
  });

  it('rejects a stored empty name', () => {
    expect(() => toProgram({ ...ROW, name: '' })).toThrow(ZodError);
  });

  it('rejects a stored empty source program ID', () => {
    expect(() => toProgram({ ...ROW, sourceProgramId: '' })).toThrow(ZodError);
  });

  it('rejects a stored ID that is not a UUID', () => {
    expect(() => toProgram({ ...ROW, id: 'not-a-uuid' })).toThrow(ZodError);
  });
});
