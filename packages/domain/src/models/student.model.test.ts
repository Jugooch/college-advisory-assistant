/**
 * @file Tests for the student data object.
 */
import { describe, expect, it } from 'vitest';

import { createStudent, type StudentInput, StudentSchema } from './student.model';

const VALID: StudentInput = {
  id: '2b3c4d5e-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  sourceStudentId: 'DEMO-S-0001',
  userId: '1a2b3c4d-0000-4000-8000-000000000001',
};

describe('createStudent', () => {
  it('accepts a student linked to a login', () => {
    expect(createStudent(VALID)).toEqual({
      id: '2b3c4d5e-0000-4000-8000-000000000001',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      sourceStudentId: 'DEMO-S-0001',
      userId: '1a2b3c4d-0000-4000-8000-000000000001',
    });
  });

  it('accepts a null userId for a student with no login yet', () => {
    expect(createStudent({ ...VALID, userId: null }).userId).toBeNull();
  });

  it('rejects an empty sourceStudentId', () => {
    expect(() => createStudent({ ...VALID, sourceStudentId: '' })).toThrow();
  });

  it('rejects an id that is not a UUID', () => {
    expect(() => createStudent({ ...VALID, id: 'DEMO-S-0001' })).toThrow();
  });
});

describe('StudentSchema', () => {
  it('rejects an omitted userId, because unknown must be an explicit null', () => {
    const result = StudentSchema.safeParse({
      id: '2b3c4d5e-0000-4000-8000-000000000001',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      sourceStudentId: 'DEMO-S-0001',
    });

    expect(result.success).toBe(false);
  });

  it('drops personal fields that are not part of the schema', () => {
    const result = StudentSchema.safeParse({ ...VALID, name: 'Demo Student' });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('name');
  });
});
