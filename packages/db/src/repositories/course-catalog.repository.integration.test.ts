/**
 * @file Integration tests for the course catalog repository against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { insertCourse, insertEquivalencyGroup, violationOf } from '../testing/catalog-fixtures';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { createCourseCatalogRepository } from './course-catalog.repository';

describe('CourseCatalogRepository.findCatalog', () => {
  let testDatabase: TestDatabase;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  it('returns the tenant catalog ordered by source course ID, with both credit forms', async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);
    const groupId = await insertEquivalencyGroup(db, tenantId, 'DEMO-EQ-01');
    const variableId = await insertCourse(db, tenantId, {
      sourceCourseId: 'DEMO-MATH-290',
      label: 'DEMO-MATH 290',
      creditsHundredths: null,
      minCreditsHundredths: 100,
      maxCreditsHundredths: 400,
    });
    const fixedId = await insertCourse(db, tenantId, {
      sourceCourseId: 'DEMO-MATH-101',
      label: 'DEMO-MATH 101',
      equivalencyGroupId: groupId,
    });

    const catalog = await createCourseCatalogRepository(db).findCatalog(tenantId);

    expect(catalog).toEqual([
      {
        id: fixedId,
        tenantId,
        sourceCourseId: 'DEMO-MATH-101',
        label: 'DEMO-MATH 101',
        creditsHundredths: 300,
        minCreditsHundredths: null,
        maxCreditsHundredths: null,
        equivalencyGroupId: groupId,
      },
      {
        id: variableId,
        tenantId,
        sourceCourseId: 'DEMO-MATH-290',
        label: 'DEMO-MATH 290',
        creditsHundredths: null,
        minCreditsHundredths: 100,
        maxCreditsHundredths: 400,
        equivalencyGroupId: null,
      },
    ]);
  });

  it("does not return another tenant's courses", async () => {
    const { db } = testDatabase;
    const tenantA = await insertTenant(db);
    const tenantB = await insertTenant(db);
    await insertCourse(db, tenantB);

    const catalog = await createCourseCatalogRepository(db).findCatalog(tenantA);

    expect(catalog).toEqual([]);
  });

  it('rejects a second course with the same source course ID in one tenant', async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);
    await insertCourse(db, tenantId);

    await expect(insertCourse(db, tenantId)).rejects.toMatchObject(
      violationOf('course_tenant_id_source_course_id_key'),
    );
  });

  it("can't join another tenant's equivalency group", async () => {
    const { db } = testDatabase;
    const tenantA = await insertTenant(db);
    const tenantB = await insertTenant(db);
    const groupOfB = await insertEquivalencyGroup(db, tenantB, 'DEMO-EQ-01');

    await expect(insertCourse(db, tenantA, { equivalencyGroupId: groupOfB })).rejects.toMatchObject(
      violationOf('course_equivalency_group_fk'),
    );
  });

  it('refuses to store a course with both fixed and variable credits', async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);

    const insert = insertCourse(db, tenantId, {
      minCreditsHundredths: 100,
      maxCreditsHundredths: 400,
    });

    await expect(insert).rejects.toMatchObject(violationOf('course_credit_form'));
  });

  it('refuses to store an inverted variable credit range', async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);

    const insert = insertCourse(db, tenantId, {
      creditsHundredths: null,
      minCreditsHundredths: 400,
      maxCreditsHundredths: 100,
    });

    await expect(insert).rejects.toMatchObject(violationOf('course_credit_range'));
  });
});
