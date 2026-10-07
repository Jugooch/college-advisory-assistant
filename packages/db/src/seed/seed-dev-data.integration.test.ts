/**
 * @file Integration tests for the dev seed against PostgreSQL: idempotency and sign-in lookup.
 */
import { count, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createPrerequisiteRule,
  IdentityStatus,
  InstitutionIdSchema,
  PrerequisiteExpressionType,
  Role,
  StudentIdSchema,
  UserIdSchema,
} from '@caa/domain';

import { createAcademicPolicyRepository } from '../repositories/academic-policy.repository';
import { createAdvisorAssignmentRepository } from '../repositories/advisor-assignment.repository';
import { createAuditSnapshotRepository } from '../repositories/audit-snapshot.repository';
import { createCourseCatalogRepository } from '../repositories/course-catalog.repository';
import { createStudentRepository } from '../repositories/student.repository';
import { createStudentSnapshotRepository } from '../repositories/student-snapshot.repository';
import { createTermRepository } from '../repositories/term.repository';
import { createUserIdentityRepository } from '../repositories/user-identity.repository';
import { academicPolicyTable } from '../tables/academic-policy.table';
import { advisorAssignmentTable } from '../tables/advisor-assignment.table';
import { auditSnapshotTable } from '../tables/audit-snapshot.table';
import { courseTable } from '../tables/course.table';
import { courseAttemptTable } from '../tables/course-attempt.table';
import { institutionTable } from '../tables/institution.table';
import { prerequisiteRuleTable } from '../tables/prerequisite-rule.table';
import { programTable } from '../tables/program.table';
import { requirementResultTable } from '../tables/requirement-result.table';
import { studentTable } from '../tables/student.table';
import { studentSnapshotTable } from '../tables/student-snapshot.table';
import { studentSnapshotAttemptTable } from '../tables/student-snapshot-attempt.table';
import { termTable } from '../tables/term.table';
import { userIdentityTable } from '../tables/user-identity.table';
import { openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { AcademicSeedReferenceError } from './academic-plan-references';
import { buildDevSeedPlan, DEV_SEED_ISSUER } from './dev-seed-plan';
import { seedDevData } from './seed-dev-data';

/** The first seed run's time, and a run one day later. */
const FIRST_RUN = new Date('2026-10-01T12:00:00.000Z');
const LATER_RUN = new Date('2026-10-02T12:00:00.000Z');
const DEV_SEED_PLAN = buildDevSeedPlan(FIRST_RUN);
const TENANT_IDS = DEV_SEED_PLAN.institutions.map((institution) => institution.id);
const TENANT_A = InstitutionIdSchema.parse(DEV_SEED_PLAN.institutions[0]?.id);

/**
 * Finds a seeded student's stored ID by source ID.
 *
 * @param testDatabase - Open test database.
 * @param sourceStudentId - Seeded source ID.
 * @returns The student ID.
 */
async function seededStudentId(testDatabase: TestDatabase, sourceStudentId: string) {
  const student = await createStudentRepository(testDatabase.db).findBySourceStudentId(
    TENANT_A,
    sourceStudentId,
  );
  return StudentIdSchema.parse(student?.id);
}

describe('seedDevData', () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = openTestDatabase();
    await seedDevData(testDatabase.db, DEV_SEED_PLAN);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  /** Every tenant-scoped seeded table, by the count name `seedDevData` reports. */
  const TENANT_TABLES = {
    identities: userIdentityTable,
    students: studentTable,
    assignments: advisorAssignmentTable,
    programs: programTable,
    courses: courseTable,
    prerequisiteRules: prerequisiteRuleTable,
    academicPolicies: academicPolicyTable,
    terms: termTable,
    courseAttempts: courseAttemptTable,
    studentSnapshots: studentSnapshotTable,
    auditSnapshots: auditSnapshotTable,
    snapshotAttemptLinks: studentSnapshotAttemptTable,
    requirementResults: requirementResultTable,
  } as const;

  async function countSeededRows(): Promise<Record<string, number | undefined>> {
    const { db } = testDatabase;
    const [institutions] = await db
      .select({ n: count() })
      .from(institutionTable)
      .where(inArray(institutionTable.id, TENANT_IDS));
    const counts: Record<string, number | undefined> = { institutions: institutions?.n };
    for (const [name, table] of Object.entries(TENANT_TABLES)) {
      const [row] = await db
        .select({ n: count() })
        .from(table)
        .where(inArray(table.tenantId, TENANT_IDS));
      counts[name] = row?.n;
    }
    return counts;
  }

  it('leaves the same row counts when it runs a second time', async () => {
    const before = await countSeededRows();

    const counts = await seedDevData(testDatabase.db, DEV_SEED_PLAN);

    expect(await countSeededRows()).toEqual(before);
    expect(before).toEqual({
      institutions: 2,
      identities: 3,
      students: 4,
      assignments: 2,
      programs: 1,
      courses: 7,
      prerequisiteRules: 7,
      academicPolicies: 1,
      terms: 4,
      courseAttempts: 4,
      studentSnapshots: 3,
      auditSnapshots: 2,
      snapshotAttemptLinks: 4,
      requirementResults: 5,
    });
    expect(before).toMatchObject(counts);
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

  it("reads the current student's audit as pinned to that student's latest snapshot", async () => {
    const studentId = await seededStudentId(testDatabase, 'SYN-000001');

    const { db } = testDatabase;
    const snapshot = await createStudentSnapshotRepository(db).findLatest(TENANT_A, studentId);
    const audit = await createAuditSnapshotRepository(db).findLatest(TENANT_A, studentId);

    expect(snapshot?.status === 'FOUND' && snapshot.revision.attempts.map((a) => a.status)).toEqual(
      ['COMPLETED', 'COMPLETED', 'IN_PROGRESS'],
    );
    expect(audit?.status === 'FOUND' && audit.audit.studentSnapshotId).toBe(
      snapshot?.status === 'FOUND' && snapshot.revision.snapshot.id,
    );
    const requirements = audit?.status === 'FOUND' ? audit.audit.requirements : [];
    expect(requirements.map((r) => r.allocatedAttemptIds.length)).toEqual([0, 1, 1, 0]);
    expect(requirements.map((r) => r.candidateCourseIds.length)).toEqual([0, 1, 2, 3]);
  });

  it("reads the stale student's audit as pinned to an older snapshot than the latest", async () => {
    const studentId = await seededStudentId(testDatabase, 'SYN-000002');

    const { db } = testDatabase;
    const snapshot = await createStudentSnapshotRepository(db).findLatest(TENANT_A, studentId);
    const audit = await createAuditSnapshotRepository(db).findLatest(TENANT_A, studentId);

    expect(snapshot?.status).toBe('FOUND');
    expect(audit?.status).toBe('FOUND');
    expect(audit?.status === 'FOUND' && audit.audit.studentSnapshotId).not.toBe(
      snapshot?.status === 'FOUND' && snapshot.revision.snapshot.id,
    );
  });

  it('reads back the catalog, policy bounds, and term order', async () => {
    const { db } = testDatabase;

    const catalog = await createCourseCatalogRepository(db).findCatalog(TENANT_A);
    const policy = await createAcademicPolicyRepository(db).findPolicy(TENANT_A, 'demo-2026.1');
    const terms = await createTermRepository(db).findOrdered(TENANT_A);

    expect(catalog.map((course) => course.label)).toEqual([
      'DEMO-ENGL 101',
      'DEMO-IND 390',
      'DEMO-MATH 101',
      'DEMO-MATH 102',
      'DEMO-PHYS 201',
      'DEMO-PHYS 301',
      'DEMO-PHYS 301L',
    ]);
    expect(policy?.termCreditBounds).toEqual({
      minCreditsHundredths: 1200,
      maxCreditsHundredths: 1800,
    });
    expect(terms.map((term) => term.termCode)).toEqual(['2025FA', '2026SP', '2026FA', '2027SP']);
  });

  it('adds one run of new snapshot and audit revisions when a later run seeds again', async () => {
    const before = await countSeededRows();
    const studentId = await seededStudentId(testDatabase, 'SYN-000001');

    await seedDevData(testDatabase.db, buildDevSeedPlan(LATER_RUN));

    const after = await countSeededRows();
    const { db } = testDatabase;
    const snapshot = await createStudentSnapshotRepository(db).findLatest(TENANT_A, studentId);
    const audit = await createAuditSnapshotRepository(db).findLatest(TENANT_A, studentId);
    const grew = (name: string) => (after[name] ?? 0) - (before[name] ?? 0);
    expect(
      Object.keys(after)
        .filter((name) => grew(name) !== 0)
        .map((name) => [name, grew(name)]),
    ).toEqual([
      ['studentSnapshots', 3],
      ['auditSnapshots', 2],
      ['snapshotAttemptLinks', 4],
      ['requirementResults', 5],
    ]);
    expect(snapshot?.status === 'FOUND' && snapshot.revision.snapshot).toMatchObject({
      id: 'a0000000-0001-4000-8000-01a0fc7c4e00',
      sourceEffectiveAt: '2026-10-02T09:00:00.000Z',
    });
    expect(audit?.status === 'FOUND' && audit.audit.studentSnapshotId).toBe(
      'a0000000-0001-4000-8000-01a0fc7c4e00',
    );
  });

  it('refuses a plan whose rule names an uncatalogued course and writes nothing', async () => {
    const before = await countSeededRows();
    const [firstRule] = DEV_SEED_PLAN.academic.rules;
    if (!firstRule) {
      throw new Error('The seed plan has no rules');
    }
    const orphanRule = createPrerequisiteRule({
      ...firstRule,
      rulesetVersion: 'demo-2099.1',
      expression: {
        type: PrerequisiteExpressionType.Course,
        courseId: '50000000-0000-4000-8000-00000000ffff',
        minimumGrade: null,
      },
    });
    const plan = {
      ...DEV_SEED_PLAN,
      academic: { ...DEV_SEED_PLAN.academic, rules: [...DEV_SEED_PLAN.academic.rules, orphanRule] },
    };

    await expect(seedDevData(testDatabase.db, plan)).rejects.toThrow(AcademicSeedReferenceError);
    expect(await countSeededRows()).toEqual(before);
  });
});
