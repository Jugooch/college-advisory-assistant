/**
 * @file Catalog display fields for the courses a response names: code, title, and credit rule.
 * @module @caa/api-contract/contracts/course-display
 * @requirement FR-05
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { CourseSchema, CreditRuleKind } from '@caa/domain';

// NOTE: the course schema carries refinements, so zod can't `.pick()` from it. Fields are
// reused one by one through `.shape`, which keeps each field's own validation.
const COURSE_FIELDS = CourseSchema.unwrap().shape;
const CREDITS_HUNDREDTHS = COURSE_FIELDS.creditsHundredths.unwrap();

/**
 * How a course awards credits, in hundredths of a credit (350 = 3.5 credits), exactly as the
 * catalog states it. `FIXED` has one value. `VARIABLE` has a range the student chooses from, and
 * no value in it is assumed until the student sends one in `creditSelections`.
 */
export const CreditRuleSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal(CreditRuleKind.Fixed),
      creditsHundredths: CREDITS_HUNDREDTHS,
    })
    .readonly(),
  z
    .object({
      kind: z.literal(CreditRuleKind.Variable),
      minCreditsHundredths: CREDITS_HUNDREDTHS,
      maxCreditsHundredths: CREDITS_HUNDREDTHS,
    })
    // SAFETY: same rule as the domain course. An inverted range would offer credit choices the
    // course can never award (planning/08 §Candidate formation and allocation).
    .refine((rule) => rule.minCreditsHundredths <= rule.maxCreditsHundredths, {
      message: 'minCreditsHundredths must not exceed maxCreditsHundredths',
      path: ['minCreditsHundredths'],
    })
    .readonly(),
]);

/** How a course awards credits. */
export type CreditRule = z.infer<typeof CreditRuleSchema>;

/**
 * Catalog display fields of one course. All text is plain catalog data, never AI-generated, and
 * none of it is identity: responses key courses by `courseId`.
 */
export const CourseDisplaySchema = z
  .object({
    courseId: COURSE_FIELDS.id,
    /** Catalog code, such as `MATH 101`: the course's catalog label. */
    code: COURSE_FIELDS.label,
    /** Catalog title, such as `Calculus I`, or `null` when the catalog doesn't supply one. */
    title: z.string().min(1).nullable(),
    credits: CreditRuleSchema,
  })
  .readonly();

/** Catalog display fields of one course. */
export type CourseDisplay = z.infer<typeof CourseDisplaySchema>;

/**
 * Display entries for the courses a response names, at most one per course. A named course with
 * no entry isn't in the catalog: the UI shows its ID and offers no credit choice for it.
 */
export const CourseDisplayListSchema = z
  .array(CourseDisplaySchema)
  .readonly()
  .refine((courses) => new Set(courses.map((course) => course.courseId)).size === courses.length, {
    message: 'courses must not repeat a course',
  });
