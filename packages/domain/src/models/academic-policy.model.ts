/**
 * @file Academic policy: institution-supplied switches the engine needs to interpret grades.
 * @module @caa/domain/models/academic-policy
 * @requirement FR-06
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

import { LetterGradeSchema } from '../enums/grade-scheme.enum';
import { RepeatPolicySchema } from '../enums/repeat-policy.enum';
import { InstitutionIdSchema } from './institution.model';

/**
 * Schema for the academic policy of one tenant in one ruleset version. Every value is
 * institution configuration, never a default built into code.
 *
 * Tenant term ordering is not part of this policy yet: until a Term model exists (S3), the
 * engine takes the tenant's term order as an explicit input.
 */
export const AcademicPolicySchema = z
  .object({
    tenantId: InstitutionIdSchema,
    /** Published ruleset version this policy belongs to, for example `demo-2026.1`. */
    rulesetVersion: z.string().min(1),
    /** Whether a student may plan a course on a prerequisite that is still in progress. */
    allowsInProgressPrerequisites: z.boolean(),
    /**
     * Whether a `P` grade meets a letter minimum grade. `null` means the institution hasn't
     * said, and the engine returns UNKNOWN (`PASS_EQUIVALENCE_UNDEFINED`), never PASS.
     */
    passSatisfiesMinimumGrade: z.boolean().nullable(),
    /**
     * Letter grades ordered highest first, as supplied by the institution. The order may be
     * partial: it lists only the letters the institution uses, and the engine treats a letter
     * missing from it as UNKNOWN rather than guessing its rank. It must not be empty.
     */
    letterGradeOrder: z.array(LetterGradeSchema).min(1).readonly(),
    /**
     * The lowest letter grade that counts as a passing completion, which the engine uses when
     * a prerequisite has no minimum grade ("any passing completion"). When set, it must appear
     * in `letterGradeOrder`. `null` means the institution hasn't said which letters pass.
     *
     * Engine contract when the prerequisite's minimum grade is `null`:
     * - A letter missing from `letterGradeOrder` is UNKNOWN (`GRADE_NOT_RANKED`), whatever
     *   this field holds.
     * - With this field set, a ranked letter at or above it is PASS, and a ranked letter below
     *   it is FAIL (`MIN_GRADE_NOT_MET`).
     * - With this field `null`, a ranked `F` is FAIL (`MIN_GRADE_NOT_MET`), and any other
     *   ranked letter is UNKNOWN (`PASSING_GRADE_UNDEFINED`), never PASS. Whether `D` or `D-`
     *   passes is institutional semantics, so the engine doesn't guess it. The dedicated code is
     *   used instead of `PASS_EQUIVALENCE_UNDEFINED`, which is only about a `P` grade meeting a
     *   letter minimum.
     */
    lowestPassingLetterGrade: LetterGradeSchema.nullable(),
    /**
     * Which attempt counts when a course was repeated. `null` means the institution hasn't
     * said, and the engine returns undetermined (`REPEAT_POLICY_UNDEFINED`), never a guess.
     */
    repeatPolicy: RepeatPolicySchema.nullable(),
  })
  // SAFETY: a repeated letter would give it two ranks, so a minimum-grade comparison could
  // pass or fail depending on which rank the engine found first.
  .refine((policy) => new Set(policy.letterGradeOrder).size === policy.letterGradeOrder.length, {
    message: 'letterGradeOrder must list each letter grade at most once',
    path: ['letterGradeOrder'],
  })
  // SAFETY: a passing cutoff the grade order doesn't rank can't be compared with any grade, so
  // the engine would have to guess which letters pass it.
  .refine(
    (policy) =>
      policy.lowestPassingLetterGrade === null ||
      policy.letterGradeOrder.includes(policy.lowestPassingLetterGrade),
    {
      message: 'lowestPassingLetterGrade must appear in letterGradeOrder',
      path: ['lowestPassingLetterGrade'],
    },
  )
  .readonly();

/** A validated, immutable academic policy. */
export type AcademicPolicy = z.infer<typeof AcademicPolicySchema>;

/** Raw input accepted by {@link createAcademicPolicy}. */
export type AcademicPolicyInput = z.input<typeof AcademicPolicySchema>;

/**
 * Creates a validated, immutable academic policy.
 *
 * @param input - Raw policy fields.
 * @returns The parsed academic policy.
 * @throws {z.ZodError} When a field is invalid, `letterGradeOrder` is empty or repeats a
 *   letter, or `lowestPassingLetterGrade` is set but missing from `letterGradeOrder`.
 */
export function createAcademicPolicy(input: AcademicPolicyInput): AcademicPolicy {
  return AcademicPolicySchema.parse(input);
}
