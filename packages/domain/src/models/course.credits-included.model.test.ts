/**
 * @file Tests for a course's credits included in a linked course, and the course catalog rules.
 */
import { describe, expect, it } from 'vitest';

import { type CourseInput, CourseSchema, createCourse, createCourseCatalog } from './course.model';

const TENANT_ID = '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f';
const OTHER_TENANT_ID = '1c9a7b47-4a8f-4b64-8d2f-9a2c3d4e5f60';
const PHYS_301_ID = '3c4d5e6f-0000-4000-8000-000000000301';
const PHYS_301L_ID = '3c4d5e6f-0000-4000-8000-000000003010';
const PHYS_301R_ID = '3c4d5e6f-0000-4000-8000-000000003011';

const LECTURE: CourseInput = {
  id: PHYS_301_ID,
  tenantId: TENANT_ID,
  sourceCourseId: 'DEMO-PHYS-301',
  label: 'DEMO-PHYS 301',
  title: null,
  creditsHundredths: 400,
  minCreditsHundredths: null,
  maxCreditsHundredths: null,
  equivalencyGroupId: null,
  creditsIncludedInCourseId: null,
};

const LAB: CourseInput = {
  ...LECTURE,
  id: PHYS_301L_ID,
  sourceCourseId: 'DEMO-PHYS-301L',
  label: 'DEMO-PHYS 301L',
  creditsHundredths: 100,
  creditsIncludedInCourseId: PHYS_301_ID,
};

describe('createCourse creditsIncludedInCourseId', () => {
  it('accepts a lab whose credits are included in its lecture', () => {
    expect(createCourse(LAB).creditsIncludedInCourseId).toBe(PHYS_301_ID);
  });

  it('accepts null, meaning the course counts its own credits', () => {
    expect(createCourse(LECTURE).creditsIncludedInCourseId).toBeNull();
  });

  it('rejects an omitted value: unknown is explicit', () => {
    const withoutField: Record<string, unknown> = { ...LECTURE };
    delete withoutField.creditsIncludedInCourseId;
    const result = CourseSchema.safeParse(withoutField);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toContainEqual([
      'creditsIncludedInCourseId',
    ]);
  });

  it('rejects a course whose credits are included in itself', () => {
    expect(() => createCourse({ ...LAB, creditsIncludedInCourseId: PHYS_301L_ID })).toThrow(
      /creditsIncludedInCourseId must not name the course itself/,
    );
  });

  it('rejects a value that is not a UUID', () => {
    expect(() => createCourse({ ...LAB, creditsIncludedInCourseId: 'DEMO-PHYS 301' })).toThrow();
  });

  it('reports the self-reference on the creditsIncludedInCourseId field', () => {
    const result = CourseSchema.safeParse({ ...LAB, creditsIncludedInCourseId: PHYS_301L_ID });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ['creditsIncludedInCourseId'],
    ]);
  });
});

describe('createCourseCatalog', () => {
  it('accepts a lecture and a lab whose credits it includes', () => {
    expect(
      createCourseCatalog([LECTURE, LAB]).map((course) => course.creditsIncludedInCourseId),
    ).toEqual([null, PHYS_301_ID]);
  });

  it('accepts a chain without a cycle and an empty catalog', () => {
    const recitation = {
      ...LAB,
      id: PHYS_301R_ID,
      sourceCourseId: 'DEMO-PHYS-301R',
      creditsIncludedInCourseId: PHYS_301L_ID,
    };

    expect(createCourseCatalog([LECTURE, LAB, recitation])).toHaveLength(3);
    expect(createCourseCatalog([])).toEqual([]);
  });

  it('rejects a two-course cycle', () => {
    expect(() =>
      createCourseCatalog([{ ...LECTURE, creditsIncludedInCourseId: PHYS_301L_ID }, LAB]),
    ).toThrow(/links must not form a cycle/);
  });

  it('rejects a three-course cycle', () => {
    const recitation = {
      ...LAB,
      id: PHYS_301R_ID,
      sourceCourseId: 'DEMO-PHYS-301R',
      creditsIncludedInCourseId: PHYS_301L_ID,
    };
    const lecture = { ...LECTURE, creditsIncludedInCourseId: PHYS_301R_ID };

    expect(() => createCourseCatalog([lecture, LAB, recitation])).toThrow(
      /links must not form a cycle/,
    );
  });

  it('rejects a link to a course outside the catalog', () => {
    expect(() => createCourseCatalog([LAB])).toThrow(/must name a course in the same catalog/);
  });

  it('rejects a link to another tenant’s course', () => {
    expect(() => createCourseCatalog([{ ...LECTURE, tenantId: OTHER_TENANT_ID }, LAB])).toThrow(
      /must belong to one tenant/,
    );
  });

  it('rejects a repeated course ID', () => {
    expect(() => createCourseCatalog([LECTURE, { ...LECTURE, sourceCourseId: 'X' }])).toThrow(
      /Course id must be unique within a catalog/,
    );
  });
});
