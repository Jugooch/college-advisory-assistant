/**
 * @file Integration tests for the student repository against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  insertStudent,
  insertTenant,
  openTestDatabase,
  type TestDatabase,
} from '../testing/integration-fixtures';
import { createStudentRepository } from './student.repository';

describe('StudentRepository', () => {
  let testDatabase: TestDatabase;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  it('finds a student by ID within its own tenant', async () => {
    const { db } = testDatabase;
    const tenantB = await insertTenant(db);
    const studentId = await insertStudent(db, tenantB, 'SYN-0001');

    const student = await createStudentRepository(db).findById(tenantB, studentId);

    expect(student).toEqual({
      id: studentId,
      tenantId: tenantB,
      sourceStudentId: 'SYN-0001',
      userId: null,
    });
  });

  it("does not let tenant A read tenant B's student by ID", async () => {
    const { db } = testDatabase;
    const tenantA = await insertTenant(db);
    const tenantB = await insertTenant(db);
    const studentId = await insertStudent(db, tenantB, 'SYN-0001');

    const student = await createStudentRepository(db).findById(tenantA, studentId);

    expect(student).toBeNull();
  });

  it("does not let tenant A read tenant B's student by source ID", async () => {
    const { db } = testDatabase;
    const tenantA = await insertTenant(db);
    const tenantB = await insertTenant(db);
    await insertStudent(db, tenantB, 'SYN-0001');

    const student = await createStudentRepository(db).findBySourceStudentId(tenantA, 'SYN-0001');

    expect(student).toBeNull();
  });
});
