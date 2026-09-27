/**
 * @file Integration tests for the dev seed against PostgreSQL: idempotency and sign-in lookup.
 */
import { count, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  IdentityStatus,
  InstitutionIdSchema,
  Role,
  StudentIdSchema,
  UserIdSchema,
} from '@caa/domain';

import { createAdvisorAssignmentRepository } from '../repositories/advisor-assignment.repository';
import { createStudentRepository } from '../repositories/student.repository';
import { createUserIdentityRepository } from '../repositories/user-identity.repository';
import { advisorAssignmentTable } from '../tables/advisor-assignment.table';
import { institutionTable } from '../tables/institution.table';
import { studentTable } from '../tables/student.table';
import { userIdentityTable } from '../tables/user-identity.table';
import { openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { DEV_SEED_ISSUER, DEV_SEED_PLAN } from './dev-seed-plan';
import { seedDevData } from './seed-dev-data';

const TENANT_IDS = DEV_SEED_PLAN.institutions.map((institution) => institution.id);

describe('seedDevData', () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = openTestDatabase();
    await seedDevData(testDatabase.db, DEV_SEED_PLAN);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  async function countSeededRows(): Promise<Record<string, number | undefined>> {
    const { db } = testDatabase;
    const [institutions] = await db
      .select({ n: count() })
      .from(institutionTable)
      .where(inArray(institutionTable.id, TENANT_IDS));
    const [identities] = await db
      .select({ n: count() })
      .from(userIdentityTable)
      .where(inArray(userIdentityTable.tenantId, TENANT_IDS));
    const [students] = await db
      .select({ n: count() })
      .from(studentTable)
      .where(inArray(studentTable.tenantId, TENANT_IDS));
    const [assignments] = await db
      .select({ n: count() })
      .from(advisorAssignmentTable)
      .where(inArray(advisorAssignmentTable.tenantId, TENANT_IDS));
    return {
      institutions: institutions?.n,
      identities: identities?.n,
      students: students?.n,
      assignments: assignments?.n,
    };
  }

  it('leaves the same row counts when it runs a second time', async () => {
    const before = await countSeededRows();

    const counts = await seedDevData(testDatabase.db, DEV_SEED_PLAN);

    expect(await countSeededRows()).toEqual(before);
    expect(before).toEqual({ institutions: 2, identities: 3, students: 4, assignments: 1 });
    expect(counts).toEqual(before);
  });

  it('lets dev auth find the seeded advisor by issuer and subject', async () => {
    const identity = await createUserIdentityRepository(testDatabase.db).findByIssuerSubject(
      DEV_SEED_ISSUER,
      'synthetic-advisor-001',
    );

    expect(identity).toMatchObject({
      tenantId: DEV_SEED_PLAN.institutions[0]?.id,
      roles: [Role.Advisor],
      status: IdentityStatus.Active,
    });
  });

  it('links the student identity and gives the advisor an active assignment to it', async () => {
    const { db } = testDatabase;
    const tenantId = InstitutionIdSchema.parse(DEV_SEED_PLAN.institutions[0]?.id);
    const identities = createUserIdentityRepository(db);
    const advisor = await identities.findByIssuerSubject(DEV_SEED_ISSUER, 'synthetic-advisor-001');
    const studentUser = await identities.findByIssuerSubject(
      DEV_SEED_ISSUER,
      'synthetic-student-001',
    );
    const student = await createStudentRepository(db).findBySourceStudentId(tenantId, 'SYN-000001');

    const assignment = await createAdvisorAssignmentRepository(db).findActive(tenantId, {
      advisorUserId: UserIdSchema.parse(advisor?.id),
      studentId: StudentIdSchema.parse(student?.id),
      at: '2026-09-26T12:00:00.000Z',
    });

    expect(student?.userId).toBe(studentUser?.id);
    expect(assignment).not.toBeNull();
  });
});
