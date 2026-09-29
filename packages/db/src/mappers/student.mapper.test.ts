/**
 * @file Tests for the student row mapper.
 */
import { describe, expect, it } from 'vitest';

import type { StudentRow } from '../tables/student.table';
import { toStudent } from './student.mapper';

const ROW: StudentRow = {
  id: '7e2d3c4b-5a6f-4e7d-9c8b-2b3c4d5e6f70',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  sourceStudentId: 'SYN-0001',
  sourceId: 'demo-sis',
  userId: null,
  recordVersion: 3,
  sourceEffectiveAt: new Date('2026-09-25T06:00:00.000Z'),
  isDeleted: false,
  createdAt: new Date('2026-09-25T12:00:00.000Z'),
};

describe('toStudent', () => {
  it('keeps only the domain fields', () => {
    const student = toStudent(ROW);

    expect(student).toEqual({
      id: '7e2d3c4b-5a6f-4e7d-9c8b-2b3c4d5e6f70',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      sourceStudentId: 'SYN-0001',
      userId: null,
    });
  });

  it('keeps a linked user ID', () => {
    const student = toStudent({ ...ROW, userId: '5d1c2b3a-4f5e-4d6c-8b7a-1a2b3c4d5e6f' });

    expect(student.userId).toBe('5d1c2b3a-4f5e-4d6c-8b7a-1a2b3c4d5e6f');
  });
});
