/**
 * @file Tests for the fixed synthetic campuses.
 */
import { describe, expect, it } from 'vitest';

import { CampusSchema } from '@caa/domain';

import { SYNTHETIC_CAMPUSES } from './synthetic-campuses';

describe('SYNTHETIC_CAMPUSES', () => {
  it('defines the north and south campuses of tenant A with fixed IDs', () => {
    expect(SYNTHETIC_CAMPUSES).toEqual({
      north: {
        id: 'd0000000-0000-4000-8000-000000000001',
        tenantId: '10000000-0000-4000-8000-000000000001',
        sourceCampusId: 'DEMO-NORTH',
        name: 'Demo North Campus',
      },
      south: {
        id: 'd0000000-0000-4000-8000-000000000002',
        tenantId: '10000000-0000-4000-8000-000000000001',
        sourceCampusId: 'DEMO-SOUTH',
        name: 'Demo South Campus',
      },
    });
  });

  it('gives every campus a valid domain campus', () => {
    expect(
      Object.values(SYNTHETIC_CAMPUSES).every((campus) => CampusSchema.safeParse(campus).success),
    ).toBe(true);
  });
});
