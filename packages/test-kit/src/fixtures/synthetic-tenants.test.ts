/**
 * @file Tests for the fixed synthetic tenants.
 */
import { describe, expect, it } from 'vitest';

import { InstitutionSchema } from '@caa/domain';

import { SYNTHETIC_TENANTS } from './synthetic-tenants';

describe('SYNTHETIC_TENANTS', () => {
  it('defines Demo State University as tenant A with a fixed ID', () => {
    expect(SYNTHETIC_TENANTS.a).toEqual({
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Demo State University',
      timezone: 'America/Chicago',
      createdAt: '2026-01-05T09:00:00.000-06:00',
    });
  });

  it('defines Sample Community College as tenant B with a fixed ID', () => {
    expect(SYNTHETIC_TENANTS.b).toEqual({
      id: '10000000-0000-4000-8000-000000000002',
      name: 'Sample Community College',
      timezone: 'America/Denver',
      createdAt: '2026-01-12T09:00:00.000-07:00',
    });
  });

  it('gives each tenant a valid institution', () => {
    expect(InstitutionSchema.safeParse(SYNTHETIC_TENANTS.a).success).toBe(true);
    expect(InstitutionSchema.safeParse(SYNTHETIC_TENANTS.b).success).toBe(true);
  });
});
