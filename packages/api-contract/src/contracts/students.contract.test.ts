/**
 * @file Tests for the student contracts.
 */
import { describe, expect, it } from 'vitest';

import { getStudentEndpoint, StudentResponseSchema } from './students.contract';

const VALID = {
  id: '2b3c4d5e-0000-4000-8000-000000000001',
  sourceStudentId: 'DEMO-S-0001',
};

describe('getStudentEndpoint', () => {
  it('declares GET /v1/students/:studentId', () => {
    expect(getStudentEndpoint).toMatchObject({
      method: 'GET',
      path: '/v1/students/:studentId',
    });
  });
});

describe('StudentResponseSchema', () => {
  it('accepts an internal ID and a source ID', () => {
    expect(StudentResponseSchema.parse(VALID)).toEqual(VALID);
  });

  it('strips server-only fields such as tenantId and userId', () => {
    const parsed = StudentResponseSchema.parse({
      ...VALID,
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      userId: null,
    });

    expect(parsed).toEqual(VALID);
  });

  it('rejects a non-UUID id', () => {
    expect(StudentResponseSchema.safeParse({ ...VALID, id: 'DEMO-S-0001' }).success).toBe(false);
  });

  it('rejects an empty sourceStudentId', () => {
    expect(StudentResponseSchema.safeParse({ ...VALID, sourceStudentId: '' }).success).toBe(false);
  });
});
