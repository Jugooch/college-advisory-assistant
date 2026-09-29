/**
 * @file Integration tests for the academic policy repository against PostgreSQL.
 */
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type InstitutionId, LetterGrade, RepeatPolicy } from '@caa/domain';

import { academicPolicyTable } from '../tables/academic-policy.table';
import { immutableRowRejectionOf, violationOf } from '../testing/catalog-fixtures';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { createAcademicPolicyRepository } from './academic-policy.repository';

type PolicyValues = Partial<Omit<typeof academicPolicyTable.$inferInsert, 'tenantId'>>;

describe('AcademicPolicyRepository.findPolicy', () => {
  let testDatabase: TestDatabase;
  let tenantId: InstitutionId;

  const insertPolicy = (values: PolicyValues = {}, owner = tenantId) =>
    testDatabase.db.insert(academicPolicyTable).values({
      tenantId: owner,
      rulesetVersion: 'demo-2026.1',
      allowsInProgressPrerequisites: false,
      letterGradeOrder: [LetterGrade.A, LetterGrade.B, LetterGrade.C, LetterGrade.D, LetterGrade.F],
      ...values,
    });

  beforeAll(async () => {
    testDatabase = openTestDatabase();
    tenantId = await insertTenant(testDatabase.db);
    await insertPolicy();
    await insertPolicy({
      rulesetVersion: 'demo-2026.2',
      allowsInProgressPrerequisites: true,
      passSatisfiesMinimumGrade: false,
      lowestPassingLetterGrade: LetterGrade.D,
      repeatPolicy: RepeatPolicy.HighestGrade,
      termMinCreditsHundredths: 1200,
      termMaxCreditsHundredths: 1800,
    });
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const repository = () => createAcademicPolicyRepository(testDatabase.db);

  it('round-trips unsupplied settings and credit bounds as null', async () => {
    const policy = await repository().findPolicy(tenantId, 'demo-2026.1');

    expect(policy).toEqual({
      tenantId,
      rulesetVersion: 'demo-2026.1',
      allowsInProgressPrerequisites: false,
      passSatisfiesMinimumGrade: null,
      letterGradeOrder: ['A', 'B', 'C', 'D', 'F'],
      lowestPassingLetterGrade: null,
      repeatPolicy: null,
      termCreditBounds: null,
    });
  });

  it('round-trips supplied settings and credit bounds', async () => {
    const policy = await repository().findPolicy(tenantId, 'demo-2026.2');

    expect(policy).toEqual({
      tenantId,
      rulesetVersion: 'demo-2026.2',
      allowsInProgressPrerequisites: true,
      passSatisfiesMinimumGrade: false,
      letterGradeOrder: ['A', 'B', 'C', 'D', 'F'],
      lowestPassingLetterGrade: 'D',
      repeatPolicy: 'HIGHEST_GRADE',
      termCreditBounds: { minCreditsHundredths: 1200, maxCreditsHundredths: 1800 },
    });
  });

  it('returns null for a version the tenant never published', async () => {
    expect(await repository().findPolicy(tenantId, 'demo-2027.1')).toBeNull();
  });

  it("does not return another tenant's policy", async () => {
    const otherTenantId = await insertTenant(testDatabase.db);

    expect(await repository().findPolicy(otherTenantId, 'demo-2026.1')).toBeNull();
  });

  it('exposes no method that changes a published policy', () => {
    expect(Object.keys(repository())).toEqual(['findPolicy']);
  });

  it('rejects a second policy for the same tenant and version', async () => {
    await expect(insertPolicy()).rejects.toMatchObject(
      violationOf('academic_policy_tenant_id_ruleset_version_key'),
    );
  });

  it('allows the same version in another tenant', async () => {
    const otherTenantId = await insertTenant(testDatabase.db);

    await insertPolicy({}, otherTenantId);

    expect(await repository().findPolicy(otherTenantId, 'demo-2026.1')).not.toBeNull();
  });

  it('refuses to store only one credit bound', async () => {
    await expect(
      insertPolicy({ rulesetVersion: 'demo-2026.8', termMinCreditsHundredths: 1200 }),
    ).rejects.toMatchObject(violationOf('academic_policy_term_credit_bounds_both_or_neither'));
  });

  it('refuses to store a credit minimum above the maximum', async () => {
    const insert = insertPolicy({
      rulesetVersion: 'demo-2026.9',
      termMinCreditsHundredths: 1900,
      termMaxCreditsHundredths: 1800,
    });

    await expect(insert).rejects.toMatchObject(
      violationOf('academic_policy_term_credit_bounds_range'),
    );
  });
});

describe('published academic policy immutability', () => {
  let testDatabase: TestDatabase;
  let tenantId: InstitutionId;

  const insertPolicy = (rulesetVersion: string) =>
    testDatabase.db.insert(academicPolicyTable).values({
      tenantId,
      rulesetVersion,
      allowsInProgressPrerequisites: false,
      letterGradeOrder: [LetterGrade.A, LetterGrade.B, LetterGrade.C, LetterGrade.D, LetterGrade.F],
    });

  const publishedVersion = () =>
    and(
      eq(academicPolicyTable.tenantId, tenantId),
      eq(academicPolicyTable.rulesetVersion, 'demo-2026.1'),
    );

  beforeAll(async () => {
    testDatabase = openTestDatabase();
    tenantId = await insertTenant(testDatabase.db);
    await insertPolicy('demo-2026.1');
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const repository = () => createAcademicPolicyRepository(testDatabase.db);

  it('refuses to update a published policy and keeps it unchanged', async () => {
    const update = testDatabase.db
      .update(academicPolicyTable)
      .set({ allowsInProgressPrerequisites: true })
      .where(publishedVersion());

    await expect(update).rejects.toMatchObject(immutableRowRejectionOf('academic_policy'));
    const policy = await repository().findPolicy(tenantId, 'demo-2026.1');
    expect(policy?.allowsInProgressPrerequisites).toBe(false);
  });

  it('refuses to delete a published policy', async () => {
    const remove = testDatabase.db.delete(academicPolicyTable).where(publishedVersion());

    await expect(remove).rejects.toMatchObject(immutableRowRejectionOf('academic_policy'));
    expect(await repository().findPolicy(tenantId, 'demo-2026.1')).not.toBeNull();
  });

  it('refuses to truncate the policy table', async () => {
    // NOTE: rolled back either way, so a missing trigger fails this test without emptying
    // the table that other test files share.
    const truncate = testDatabase.db.transaction(async (tx) => {
      await tx.execute(sql`TRUNCATE TABLE academic_policy`);
      tx.rollback();
    });

    await expect(truncate).rejects.toMatchObject(immutableRowRejectionOf('academic_policy'));
  });

  it('still publishes a new version as an insert', async () => {
    await insertPolicy('demo-2026.2');

    expect(await repository().findPolicy(tenantId, 'demo-2026.2')).not.toBeNull();
  });
});
