/**
 * @file Tests for the institution row mapper.
 */
import { describe, expect, it } from 'vitest';

import { toInstitution } from './institution.mapper';

describe('toInstitution', () => {
  it('converts the timestamp to an ISO string', () => {
    const institution = toInstitution({
      id: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      name: 'Demo State University',
      timezone: 'America/Chicago',
      createdAt: new Date('2026-09-25T12:00:00.000Z'),
    });

    expect(institution.createdAt).toBe('2026-09-25T12:00:00.000Z');
  });
});
