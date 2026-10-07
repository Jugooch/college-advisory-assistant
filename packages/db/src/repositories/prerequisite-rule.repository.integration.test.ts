/**
 * @file Integration tests for the prerequisite rule repository against PostgreSQL.
 */
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type { CourseId, InstitutionId } from '@caa/domain';

import { prerequisiteRuleTable } from '../tables/prerequisite-rule.table';
import { immutableRowRejectionOf, insertCourse, violationOf } from '../testing/catalog-fixtures';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { createPrerequisiteRuleRepository } from './prerequisite-rule.repository';

describe('PrerequisiteRuleRepository.findRule', () => {
  let testDatabase: TestDatabase;
  let tenantId: InstitutionId;
  let math101: CourseId;
  let math102: CourseId;

  const courseExpression = (courseId: CourseId, minimumGrade: string | null) => ({
    type: 'COURSE',
    courseId,
    minimumGrade: minimumGrade === null ? null : { scheme: 'LETTER', value: minimumGrade },
  });

  const insertRule = (rulesetVersion: string, expression: unknown, owner = tenantId) =>
    testDatabase.db.insert(prerequisiteRuleTable).values({
      tenantId: owner,
      courseId: math102,
      rulesetVersion,
      expression,
      sourceRef: `demo-rule-${rulesetVersion}`,
    });

  beforeAll(async () => {
    testDatabase = openTestDatabase();
    const { db } = testDatabase;
    tenantId = await insertTenant(db);
    math101 = await insertCourse(db, tenantId, { sourceCourseId: 'DEMO-MATH-101' });
    math102 = await insertCourse(db, tenantId, { sourceCourseId: 'DEMO-MATH-102' });
    await insertRule('demo-2026.1', courseExpression(math101, 'C'));
    await insertRule('demo-2026.2', {
      type: 'ALL',
      items: [
        courseExpression(math101, 'B'),
        {
          type: 'UNSUPPORTED',
          sourceText: 'Or consent of instructor',
          reasonCode: 'UNSUPPORTED_RULE',
        },
      ],
    });
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const repository = () => createPrerequisiteRuleRepository(testDatabase.db);

  it('round-trips the rule of the requested ruleset version', async () => {
    const rule = await repository().findRule(tenantId, math102, 'demo-2026.1');

    expect(rule).toEqual({
      tenantId,
      courseId: math102,
      expression: courseExpression(math101, 'C'),
      sourceRef: 'demo-rule-demo-2026.1',
      rulesetVersion: 'demo-2026.1',
    });
  });

  it('keeps each published version as its own rule', async () => {
    const rule = await repository().findRule(tenantId, math102, 'demo-2026.2');

    expect(rule?.expression).toEqual({
      type: 'ALL',
      items: [
        courseExpression(math101, 'B'),
        {
          type: 'UNSUPPORTED',
          sourceText: 'Or consent of instructor',
          reasonCode: 'UNSUPPORTED_RULE',
        },
      ],
    });
  });

  it('returns null when the version has no rule for the course', async () => {
    expect(await repository().findRule(tenantId, math101, 'demo-2026.1')).toBeNull();
    expect(await repository().findRule(tenantId, math102, 'demo-2027.1')).toBeNull();
  });

  it("does not return another tenant's rule", async () => {
    const otherTenantId = await insertTenant(testDatabase.db);

    expect(await repository().findRule(otherTenantId, math102, 'demo-2026.1')).toBeNull();
  });

  it('exposes no method that changes a published rule', () => {
    expect(Object.keys(repository())).toEqual(['findRule']);
  });

  const publishedRule = () =>
    and(
      eq(prerequisiteRuleTable.tenantId, tenantId),
      eq(prerequisiteRuleTable.courseId, math102),
      eq(prerequisiteRuleTable.rulesetVersion, 'demo-2026.1'),
    );

  it('refuses to update a published rule and keeps it unchanged', async () => {
    const update = testDatabase.db
      .update(prerequisiteRuleTable)
      .set({ expression: courseExpression(math101, 'A') })
      .where(publishedRule());

    await expect(update).rejects.toMatchObject(immutableRowRejectionOf('prerequisite_rule'));
    const rule = await repository().findRule(tenantId, math102, 'demo-2026.1');
    expect(rule?.expression).toEqual(courseExpression(math101, 'C'));
  });

  it('refuses to delete a published rule', async () => {
    const remove = testDatabase.db.delete(prerequisiteRuleTable).where(publishedRule());

    await expect(remove).rejects.toMatchObject(immutableRowRejectionOf('prerequisite_rule'));
    expect(await repository().findRule(tenantId, math102, 'demo-2026.1')).not.toBeNull();
  });

  it('refuses to truncate the rule table', async () => {
    // NOTE: rolled back either way, so a missing trigger fails this test without emptying
    // the table that other test files share.
    const truncate = testDatabase.db.transaction(async (tx) => {
      await tx.execute(sql`TRUNCATE TABLE prerequisite_rule`);
      tx.rollback();
    });

    await expect(truncate).rejects.toMatchObject(immutableRowRejectionOf('prerequisite_rule'));
  });

  it('still publishes a new version as an insert', async () => {
    await insertRule('demo-2026.4', courseExpression(math101, 'D'));

    const rule = await repository().findRule(tenantId, math102, 'demo-2026.4');
    expect(rule?.expression).toEqual(courseExpression(math101, 'D'));
  });

  it('rejects a second rule for the same course and version', async () => {
    await expect(insertRule('demo-2026.1', courseExpression(math101, 'A'))).rejects.toMatchObject(
      violationOf('prerequisite_rule_tenant_id_course_id_ruleset_version_key'),
    );
  });

  it("can't state a rule for another tenant's course", async () => {
    const otherTenantId = await insertTenant(testDatabase.db);

    const insert = insertRule('demo-2026.1', courseExpression(math101, 'C'), otherTenantId);

    await expect(insert).rejects.toMatchObject(violationOf('prerequisite_rule_course_fk'));
  });

  it('refuses to store an expression that is not a JSON object', async () => {
    await expect(insertRule('demo-2026.9', ['ALL'])).rejects.toMatchObject(
      violationOf('prerequisite_rule_expression_object'),
    );
  });

  it('fails loudly when the stored expression is invalid', async () => {
    await insertRule('demo-2026.3', { type: 'ANY', items: [] });

    await expect(repository().findRule(tenantId, math102, 'demo-2026.3')).rejects.toThrow(ZodError);
  });

  it('reads a stored NONE rule back as an explicit no-prerequisite rule', async () => {
    await insertRule('demo-2026.4', { type: 'NONE' });

    const rule = await repository().findRule(tenantId, math102, 'demo-2026.4');

    expect(rule?.expression).toEqual({ type: 'NONE' });
  });

  it('fails loudly when a stored NONE carries extra fields', async () => {
    await insertRule('demo-2026.5', { type: 'NONE', items: [] });

    await expect(repository().findRule(tenantId, math102, 'demo-2026.5')).rejects.toThrow(ZodError);
  });
});
