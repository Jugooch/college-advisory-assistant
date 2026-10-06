/**
 * @file Tests for the campus row mapper.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type { CampusRow } from '../tables/campus.table';
import { toCampus } from './campus.mapper';

const ROW: CampusRow = {
  id: '3c4d5e6f-7081-4a92-8b3c-4d5e6f708192',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  sourceCampusId: 'DEMO-N',
  name: 'North Campus',
  createdAt: new Date('2026-09-25T12:00:00.000Z'),
};

describe('toCampus', () => {
  it('keeps only the domain fields', () => {
    expect(toCampus(ROW)).toEqual({
      id: ROW.id,
      tenantId: ROW.tenantId,
      sourceCampusId: 'DEMO-N',
      name: 'North Campus',
    });
  });

  it('rejects a stored empty name', () => {
    expect(() => toCampus({ ...ROW, name: '' })).toThrow(ZodError);
  });

  it('rejects a stored ID that is not a UUID', () => {
    expect(() => toCampus({ ...ROW, id: 'not-a-uuid' })).toThrow(ZodError);
  });
});
