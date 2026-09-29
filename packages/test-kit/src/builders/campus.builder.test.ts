/**
 * @file Tests for the synthetic campus builder.
 */
import { describe, expect, it } from 'vitest';

import { CampusSchema } from '@caa/domain';

import { buildCampus } from './campus.builder';

describe('buildCampus', () => {
  it('defaults to campus seed 1 of tenant A', () => {
    expect(buildCampus()).toEqual({
      id: 'd0000000-0000-4000-8000-000000000001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      sourceCampusId: 'DEMO-CAMPUS-001',
      name: 'Demo Campus 001',
    });
  });

  it('derives the id, source ID and name from the seed', () => {
    const campus = buildCampus({}, 12);

    expect([campus.id, campus.sourceCampusId, campus.name]).toEqual([
      'd0000000-0000-4000-8000-00000000000c',
      'DEMO-CAMPUS-012',
      'Demo Campus 012',
    ]);
  });

  it('returns deep-equal campuses for the same arguments', () => {
    expect(buildCampus({ name: 'Demo West Campus' }, 3)).toEqual(
      buildCampus({ name: 'Demo West Campus' }, 3),
    );
  });

  it('applies overrides', () => {
    expect(buildCampus({ tenantId: '10000000-0000-4000-8000-000000000002' }).tenantId).toBe(
      '10000000-0000-4000-8000-000000000002',
    );
  });

  it('returns a campus that passes the domain schema', () => {
    expect(CampusSchema.safeParse(buildCampus()).success).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(() => buildCampus({ name: '' })).toThrow();
  });
});
