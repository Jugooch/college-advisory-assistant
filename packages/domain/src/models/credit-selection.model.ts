/**
 * @file Credit selection: the credit value a student chose for one variable-credit course.
 * @module @caa/domain/models/credit-selection
 * @requirement FR-05
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

import { CourseIdSchema } from './course.model';

/** The credit value chosen for one variable-credit course. */
export const CreditSelectionSchema = z
  .strictObject({
    courseId: CourseIdSchema,
    /** Chosen credits in hundredths of a credit (350 = 3.5 credits). Never a float. */
    selectedCreditsHundredths: z.number().int().nonnegative(),
  })
  .readonly();

/** A validated credit selection. */
export type CreditSelection = z.infer<typeof CreditSelectionSchema>;

/** Raw input accepted by {@link createCreditSelection}. */
export type CreditSelectionInput = z.input<typeof CreditSelectionSchema>;

/**
 * Creates a validated, immutable credit selection.
 *
 * @param input - Raw selection fields.
 * @returns The parsed credit selection.
 * @throws {z.ZodError} When a field is invalid or an unknown key is present.
 */
export function createCreditSelection(input: CreditSelectionInput): CreditSelection {
  return CreditSelectionSchema.parse(input);
}
