/**
 * @file Parses the revalidate form: which plan, which revision the student was looking at, and
 * whether that revision had a chosen option.
 * @module @caa/web/features/plan-drafts/utils/revalidate-form
 * @requirement FR-11
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { type RevalidatePlanRequest, RevalidatePlanRequestSchema } from '@caa/api-contract';
import { type PlanId, PlanIdSchema, type StudentId, StudentIdSchema } from '@caa/domain';

/** Form field that carries the internal student ID from the page URL. */
export const REVALIDATE_STUDENT_FIELD = 'studentId';

/** Form field that carries the plan ID. */
export const REVALIDATE_PLAN_FIELD = 'planId';

/** Form field that carries the revision number the student was looking at. */
export const REVALIDATE_REVISION_FIELD = 'expectedRevision';

/** Form field that says whether that revision had a chosen option (`true` or `false`). */
export const REVALIDATE_SELECTION_FIELD = 'hadSelection';

/** A parsed revalidate form. */
export interface RevalidateForm {
  readonly studentId: StudentId;
  readonly planId: PlanId;
  readonly body: RevalidatePlanRequest;
  readonly hadSelection: boolean;
}

/**
 * Parses a submitted revalidate form. The tenant and user are never read from it.
 *
 * @param formData - The submitted form.
 * @returns The parsed form, or `null` when any field is missing or malformed.
 */
export function parseRevalidateForm(formData: FormData): RevalidateForm | null {
  const studentId = StudentIdSchema.safeParse(formData.get(REVALIDATE_STUDENT_FIELD));
  const planId = PlanIdSchema.safeParse(formData.get(REVALIDATE_PLAN_FIELD));
  const revision = Number(formData.get(REVALIDATE_REVISION_FIELD));
  const body = RevalidatePlanRequestSchema.safeParse({ expectedRevision: revision });
  const selection = formData.get(REVALIDATE_SELECTION_FIELD);
  if (
    !studentId.success ||
    !planId.success ||
    !body.success ||
    (selection !== 'true' && selection !== 'false')
  ) {
    return null;
  }
  return {
    studentId: studentId.data,
    planId: planId.data,
    body: body.data,
    hadSelection: selection === 'true',
  };
}
