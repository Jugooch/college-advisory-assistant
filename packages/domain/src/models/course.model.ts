/**
 * @file Course data object: a tenant's catalog course, its credit value, and equivalency group.
 * @module @caa/domain/models/course
 * @requirement FR-05
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { InstitutionIdSchema } from './institution.model';

/** Branded ID so a course ID can never be passed where another ID is expected. */
export const CourseIdSchema = z.uuid().brand<'CourseId'>();

/** Unique identifier of a {@link Course}. */
export type CourseId = z.infer<typeof CourseIdSchema>;

/** Branded ID of a group of courses the institution treats as equivalent to one another. */
export const EquivalencyGroupIdSchema = z.uuid().brand<'EquivalencyGroupId'>();

/** Unique identifier of an equivalency group. */
export type EquivalencyGroupId = z.infer<typeof EquivalencyGroupIdSchema>;

/** Schema for a credit amount in hundredths of a credit (350 = 3.5 credits). Never a float. */
const CreditsHundredthsSchema = z.number().int().nonnegative();

/**
 * Schema for the institution's statement that a course is repeatable for credit, such as an
 * ensemble or a topics course, with its optional caps (AC04). Each cap is `null` when the
 * institution states none; a stated cap limits how many attempts or credits may count.
 */
export const RepeatableForCreditSchema = z
  .object({
    /** Most attempts that may earn credit, at least 2, or `null` when no attempt cap is stated. */
    maxAttempts: z.number().int().min(2).nullable(),
    /** Most credits all attempts may earn together, in hundredths, or `null` when uncapped. */
    maxCreditsHundredths: z.number().int().positive().nullable(),
  })
  .readonly();

/** A validated, immutable repeat-for-credit statement. */
export type RepeatableForCredit = z.infer<typeof RepeatableForCreditSchema>;

/**
 * Schema for a course.
 *
 * A course has exactly one credit form:
 * - fixed: `creditsHundredths` is set, and `minCreditsHundredths` and `maxCreditsHundredths`
 *   are `null`;
 * - variable: `creditsHundredths` is `null`, and both bounds are set with min ≤ max.
 */
export const CourseSchema = z
  .object({
    id: CourseIdSchema,
    tenantId: InstitutionIdSchema,
    /** Course identifier in the source system. Distinct from the internal {@link CourseId}. */
    sourceCourseId: z.string().min(1),
    /** Display text such as `MATH 101`. Labels can change, so this is never used as identity. */
    label: z.string().min(1),
    /**
     * Catalog title such as `Calculus I`: plain catalog data, never AI-generated and never
     * identity. `null` means the catalog supplies no title.
     */
    title: z.string().min(1).nullable(),
    /** Fixed credit value in hundredths of a credit, or `null` for a variable-credit course. */
    creditsHundredths: CreditsHundredthsSchema.nullable(),
    /** Lower credit bound in hundredths for a variable-credit course, or `null` when fixed. */
    minCreditsHundredths: CreditsHundredthsSchema.nullable(),
    /** Upper credit bound in hundredths for a variable-credit course, or `null` when fixed. */
    maxCreditsHundredths: CreditsHundredthsSchema.nullable(),
    /** Equivalency group this course belongs to, or `null` when it has no equivalents. */
    equivalencyGroupId: EquivalencyGroupIdSchema.nullable(),
    /**
     * The linked course whose credit total already includes this course's credits, such as a
     * lab counted in its lecture's total. `null` means this course counts its own credits.
     * Sourced from the institution's catalog, never inferred from labels or course numbers.
     * Credit-load callers derive `CourseSelection.countsCredits` from it, so the credits are
     * counted once.
     *
     * Required: `null` means the course counts its own credits; a value is never omitted.
     */
    creditsIncludedInCourseId: CourseIdSchema.nullable(),
    /**
     * The institution's statement that attempts of this course may each earn credit, with any
     * caps. `null` means the institution doesn't state that, so only one attempt counts (AC04:
     * duplicate earned credit only when policy explicitly permits it). Sourced from the
     * institution's catalog, never inferred from labels such as "topics". Required: an omitted
     * value doesn't parse (standard 04 rule 10).
     */
    repeatableForCredit: RepeatableForCreditSchema.nullable(),
  })
  // SAFETY: a course whose credits are included in itself would drop its own credits from
  // every credit total.
  .refine((course) => course.creditsIncludedInCourseId !== course.id, {
    message: 'creditsIncludedInCourseId must not name the course itself',
    path: ['creditsIncludedInCourseId'],
  })
  // SAFETY: a repeat credit cap below what one attempt earns would contradict the course's own
  // credits, so the engine couldn't tell whether even the first attempt counts in full.
  .refine(
    (course) => {
      const cap = course.repeatableForCredit?.maxCreditsHundredths ?? null;
      const oneAttempt = course.creditsHundredths ?? course.minCreditsHundredths;
      return cap === null || oneAttempt === null || cap >= oneAttempt;
    },
    {
      message: "repeatableForCredit.maxCreditsHundredths must cover one attempt's credits",
      path: ['repeatableForCredit', 'maxCreditsHundredths'],
    },
  )
  // SAFETY: credit totals drive load and progress checks, so a course must state its credits
  // in exactly one unambiguous form rather than letting readers pick between two.
  .refine(
    (course) =>
      course.creditsHundredths === null
        ? course.minCreditsHundredths !== null && course.maxCreditsHundredths !== null
        : course.minCreditsHundredths === null && course.maxCreditsHundredths === null,
    {
      message:
        'A course has either creditsHundredths or both minCreditsHundredths and maxCreditsHundredths',
      path: ['creditsHundredths'],
    },
  )
  // SAFETY: an inverted range would let the engine count credits the course can never award.
  .refine(
    (course) =>
      course.minCreditsHundredths === null ||
      course.maxCreditsHundredths === null ||
      course.minCreditsHundredths <= course.maxCreditsHundredths,
    {
      message: 'minCreditsHundredths must not exceed maxCreditsHundredths',
      path: ['minCreditsHundredths'],
    },
  )
  .readonly();

/** A validated, immutable course. */
export type Course = z.infer<typeof CourseSchema>;

/** Raw input accepted by {@link createCourse}. */
export type CourseInput = z.input<typeof CourseSchema>;

/**
 * Creates a validated, immutable course.
 *
 * @param input - Raw course fields.
 * @returns The parsed course.
 * @throws {z.ZodError} When a field is invalid, the course mixes or omits credit forms, its
 *   minimum credits exceed its maximum, or its credits are included in itself.
 */
export function createCourse(input: CourseInput): Course {
  return CourseSchema.parse(input);
}

/**
 * Returns whether following `creditsIncludedInCourseId` from any course of the catalog reaches
 * that course again.
 *
 * @param courses - A catalog whose course IDs are unique.
 * @returns `true` when the credit-inclusion links form a cycle.
 */
function hasCreditInclusionCycle(courses: readonly Course[]): boolean {
  const includedIn = new Map(
    courses.map((course) => [course.id, course.creditsIncludedInCourseId] as const),
  );
  return courses.some((course) => {
    let next = includedIn.get(course.id) ?? null;
    for (let step = 0; next !== null && step < courses.length; step += 1) {
      if (next === course.id) return true;
      next = includedIn.get(next) ?? null;
    }
    return false;
  });
}

/**
 * Schema for one tenant's course catalog. An empty catalog is valid and means the tenant
 * supplied no courses.
 *
 * It checks the rules a single course can't: course IDs are unique, and every
 * `creditsIncludedInCourseId` names a course in the same catalog, so it can't point at another
 * tenant's course, and the links form no cycle.
 */
export const CourseCatalogSchema = z
  .array(CourseSchema)
  .readonly()
  // SAFETY: course IDs are tenant-specific, so mixing tenants would count one tenant's credits
  // under another tenant's catalog.
  .refine((courses) => courses.every((course) => course.tenantId === courses[0]?.tenantId), {
    message: 'All courses in a catalog must belong to one tenant',
  })
  .refine((courses) => new Set(courses.map((course) => course.id)).size === courses.length, {
    message: 'Course id must be unique within a catalog',
  })
  // SAFETY: a link to a course outside the catalog, including another tenant's, can't be
  // resolved, so credit load could drop credits that no course in the plan counts.
  .refine(
    (courses) => {
      const ids = new Set<string>(courses.map((course) => course.id));
      return courses.every(
        (course) =>
          course.creditsIncludedInCourseId === null || ids.has(course.creditsIncludedInCourseId),
      );
    },
    { message: 'creditsIncludedInCourseId must name a course in the same catalog' },
  )
  // SAFETY: in a cycle, every course's credits are included in another's, so none of them is
  // ever counted.
  .refine((courses) => !hasCreditInclusionCycle(courses), {
    message: 'creditsIncludedInCourseId links must not form a cycle',
  });

/** A validated, immutable course catalog. */
export type CourseCatalog = z.infer<typeof CourseCatalogSchema>;

/** Raw input accepted by {@link createCourseCatalog}. */
export type CourseCatalogInput = z.input<typeof CourseCatalogSchema>;

/**
 * Creates a validated, immutable course catalog.
 *
 * @param input - One tenant's courses.
 * @returns The parsed course catalog.
 * @throws {z.ZodError} When a course is invalid, the courses belong to more than one tenant, a
 *   course ID repeats, a `creditsIncludedInCourseId` names a course outside the catalog, or the
 *   credit-inclusion links form a cycle.
 */
export function createCourseCatalog(input: CourseCatalogInput): CourseCatalog {
  return CourseCatalogSchema.parse(input);
}
