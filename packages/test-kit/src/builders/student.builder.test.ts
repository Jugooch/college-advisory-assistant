/**
 * @file Tests for the synthetic student builder.
 */
import { describe, expect, it } from 'vitest';

import { StudentSchema } from '@caa/domain';

import { buildStudent } from './student.builder';

describe('buildStudent', () => {
  it('defaults to an unlinked student in tenant A', () => {
    expect(buildStudent()).toEqual({
      id: '30000000-0000-4000-8000-000000000001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      sourceStudentId: 'SYN-000001',
      userId: null,
    });
  });

  it('returns deep-equal students for the same arguments', () => {
    expect(buildStudent({}, 7)).toEqual(buildStudent({}, 7));
  });

  it('derives the id and sourceStudentId from the seed', () => {
    const student = buildStudent({}, 12);

    expect(student.id).toBe('30000000-0000-4000-8000-00000000000c');
    expect(student.sourceStudentId).toBe('SYN-000012');
  });

  it('applies overrides', () => {
    const student = buildStudent({
      tenantId: '10000000-0000-4000-8000-000000000002',
      userId: '20000000-0000-4000-8000-000000000001',
    });

    expect(student.tenantId).toBe('10000000-0000-4000-8000-000000000002');
    expect(student.userId).toBe('20000000-0000-4000-8000-000000000001');
  });

  it('returns a student that passes the domain schema', () => {
    expect(StudentSchema.safeParse(buildStudent()).success).toBe(true);
  });

  it('rejects overrides the domain forbids', () => {
    expect(() => buildStudent({ sourceStudentId: '' })).toThrow();
  });
});
