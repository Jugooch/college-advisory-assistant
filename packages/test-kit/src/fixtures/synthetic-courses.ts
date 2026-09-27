/**
 * @file The fixed synthetic course catalog in tenant A, so tests and golden cases can name courses.
 * @module @caa/test-kit/fixtures/synthetic-courses
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { type Course, type CourseInput, createCourse } from '@caa/domain';

import { syntheticId } from './synthetic-id';
import { SYNTHETIC_TENANTS } from './synthetic-tenants';

/** Keys of {@link SYNTHETIC_COURSES}. */
export type SyntheticCourseKey =
  'math101' | 'math111' | 'math102' | 'phys201' | 'phys201Lab' | 'ind390';

/** The equivalency group shared by DEMO-MATH 101 and DEMO-MATH 111. */
export const SYNTHETIC_MATH_EQUIVALENCY_GROUP_ID = syntheticId('equivalencyGroup', 1);

/** Fields of one catalog entry that differ between courses. */
type CatalogEntry = Pick<
  CourseInput,
  | 'label'
  | 'creditsHundredths'
  | 'minCreditsHundredths'
  | 'maxCreditsHundredths'
  | 'equivalencyGroupId'
>;

/**
 * Creates a catalog course in tenant A. The source ID is the label with the space replaced by a
 * hyphen, for example `DEMO-MATH-101`.
 *
 * @param seed - Drives the course `id`; chosen so the hex reads like the course number.
 * @param entry - Label, credits, and equivalency group.
 * @returns A validated course.
 */
function catalogCourse(seed: number, entry: CatalogEntry): Course {
  return createCourse({
    id: syntheticId('course', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    sourceCourseId: entry.label.replace(' ', '-'),
    ...entry,
  });
}

/**
 * Describes a fixed-credit catalog entry.
 *
 * @param label - Display label, for example `DEMO-MATH 101`.
 * @param creditsHundredths - Fixed credits in hundredths.
 * @param equivalencyGroupId - Equivalency group, or `null` for none.
 * @returns The catalog entry.
 */
function fixed(
  label: string,
  creditsHundredths: number,
  equivalencyGroupId: string | null = null,
): CatalogEntry {
  return {
    label,
    creditsHundredths,
    minCreditsHundredths: null,
    maxCreditsHundredths: null,
    equivalencyGroupId,
  };
}

/**
 * Fixed synthetic course catalog in tenant A. Every subject and course is fictional.
 *
 * | Key          | Label          | Credits      | Equivalency group | ID (last group) |
 * | ------------ | -------------- | ------------ | ----------------- | --------------- |
 * | `math101`    | DEMO-MATH 101  | 3.00         | group 1           | `000000000101`  |
 * | `math111`    | DEMO-MATH 111  | 3.00         | group 1           | `000000000111`  |
 * | `math102`    | DEMO-MATH 102  | 3.00         | none              | `000000000102`  |
 * | `phys201`    | DEMO-PHYS 201  | 4.00         | none              | `000000000201`  |
 * | `phys201Lab` | DEMO-PHYS 201L | 1.00         | none              | `000000002010`  |
 * | `ind390`     | DEMO-IND 390   | 1.00 to 3.00 | none              | `000000000390`  |
 *
 * Course IDs are `50000000-0000-4000-8000-<last group>`, and each source course ID is the
 * label with a hyphen for the space (`DEMO-MATH-101`). Equivalency group 1 is
 * `90000000-0000-4000-8000-000000000001`, so DEMO-MATH 101 and DEMO-MATH 111 are equivalents.
 * The catalog states no prerequisites; build those with `buildPrerequisiteRule`.
 */
export const SYNTHETIC_COURSES: Readonly<Record<SyntheticCourseKey, Course>> = {
  math101: catalogCourse(0x101, fixed('DEMO-MATH 101', 300, SYNTHETIC_MATH_EQUIVALENCY_GROUP_ID)),
  math111: catalogCourse(0x111, fixed('DEMO-MATH 111', 300, SYNTHETIC_MATH_EQUIVALENCY_GROUP_ID)),
  math102: catalogCourse(0x102, fixed('DEMO-MATH 102', 300)),
  phys201: catalogCourse(0x201, fixed('DEMO-PHYS 201', 400)),
  phys201Lab: catalogCourse(0x2010, fixed('DEMO-PHYS 201L', 100)),
  ind390: catalogCourse(0x390, {
    label: 'DEMO-IND 390',
    creditsHundredths: null,
    minCreditsHundredths: 100,
    maxCreditsHundredths: 300,
    equivalencyGroupId: null,
  }),
};
