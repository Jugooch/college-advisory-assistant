/**
 * @file Integration tests for the student repository against PostgreSQL.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { StudentId, UserId } from '@caa/domain';

import { studentTable } from '../tables/student.table';
import {
  insertStudent,
  insertTenant,
  insertUser,
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

describe('StudentRepository.findByUserId', () => {
  let testDatabase: TestDatabase;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  /**
   * Links a synthetic student to a user, as the roster link does after sign-in.
   *
   * @param studentId - Student to link.
   * @param userId - User identity in the same tenant.
   */
  async function link(studentId: StudentId, userId: UserId): Promise<void> {
    await testDatabase.db
      .update(studentTable)
      .set({ userId })
      .where(eq(studentTable.id, studentId));
  }

  it("finds the user's own student in the user's tenant", async () => {
    const { db } = testDatabase;
    const tenant = await insertTenant(db);
    const userId = await insertUser(db, tenant, 'student');
    const studentId = await insertStudent(db, tenant, 'SYN-0001');
    await insertStudent(db, tenant, 'SYN-0002');
    await link(studentId, userId);

    const student = await createStudentRepository(db).findByUserId(tenant, userId);

    expect(student).toEqual({
      id: studentId,
      tenantId: tenant,
      sourceStudentId: 'SYN-0001',
      userId,
    });
  });

  it('returns null for a user with no student link, such as an advisor', async () => {
    const { db } = testDatabase;
    const tenant = await insertTenant(db);
    const advisorId = await insertUser(db, tenant, 'advisor');
    await insertStudent(db, tenant, 'SYN-0001');

    expect(await createStudentRepository(db).findByUserId(tenant, advisorId)).toBeNull();
  });

  it("returns null for another tenant's linked user", async () => {
    const { db } = testDatabase;
    const tenantA = await insertTenant(db);
    const tenantB = await insertTenant(db);
    const userB = await insertUser(db, tenantB, 'student');
    await link(await insertStudent(db, tenantB, 'SYN-0001'), userB);

    expect(await createStudentRepository(db).findByUserId(tenantA, userB)).toBeNull();
  });

  it('returns null when the linked student was deleted by the source', async () => {
    const { db } = testDatabase;
    const tenant = await insertTenant(db);
    const userId = await insertUser(db, tenant, 'student');
    const studentId = await insertStudent(db, tenant, 'SYN-0001');
    await link(studentId, userId);
    await db.update(studentTable).set({ isDeleted: true }).where(eq(studentTable.id, studentId));

    expect(await createStudentRepository(db).findByUserId(tenant, userId)).toBeNull();
  });

  it('refuses to choose when two current students are linked to the same user', async () => {
    const { db } = testDatabase;
    const tenant = await insertTenant(db);
    const userId = await insertUser(db, tenant, 'student');
    await link(await insertStudent(db, tenant, 'SYN-0001'), userId);
    await link(await insertStudent(db, tenant, 'SYN-0002'), userId);

    await expect(createStudentRepository(db).findByUserId(tenant, userId)).rejects.toThrow(
      'more than one current student',
    );
  });
});
