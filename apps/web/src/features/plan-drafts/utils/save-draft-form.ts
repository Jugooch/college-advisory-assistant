/**
 * @file Encodes and parses the save-draft form: the search request, the chosen sections, and the
 * pinned inputs the student was shown travel as one JSON field.
 * @module @caa/web/features/plan-drafts/utils/save-draft-form
 * @requirement FR-11
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import {
  type SavePlanRequest,
  SavePlanRequestSchema,
  type ScheduleOption,
} from '@caa/api-contract';
import { type StudentId, StudentIdSchema } from '@caa/domain';

/** Form field that carries the encoded {@link SavePlanRequest}. */
export const DRAFT_FIELD = 'draft';

/** Form field that carries the internal student ID from the page URL. */
export const STUDENT_FIELD = 'studentId';

/** A parsed save-draft form. */
export interface SaveDraftForm {
  readonly studentId: StudentId;
  readonly body: SavePlanRequest;
}

/**
 * Lists the section IDs of an option, in the order the API expects them: sorted and distinct.
 *
 * @param option - A schedule option from the API.
 * @returns Its section IDs. No section is added, dropped, or substituted.
 */
export function optionSectionIds(option: ScheduleOption): SavePlanRequest['selectedSectionIds'] {
  const ids = option.bundles.flatMap((bundle) =>
    bundle.sections.map((section) => section.sectionId),
  );
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b, 'en'));
}

/**
 * Encodes the save request for a hidden form field.
 *
 * @param body - The request: the original search, the chosen sections or `null`, and the pinned
 *   inputs from the response.
 * @returns A JSON string.
 */
export function encodeSaveDraft(body: SavePlanRequest): string {
  return JSON.stringify(body);
}

/**
 * Parses a submitted save-draft form.
 *
 * @param formData - The submitted form.
 * @returns The student and request, or `null` when either field is missing or doesn't parse.
 */
export function parseSaveDraftForm(formData: FormData): SaveDraftForm | null {
  const studentId = StudentIdSchema.safeParse(formData.get(STUDENT_FIELD));
  const draft = formData.get(DRAFT_FIELD);
  if (!studentId.success || typeof draft !== 'string') {
    return null;
  }
  try {
    // SECURITY: the field is external input, so the contract schema parses it. It rejects any
    // tenant, user, or role field, and the API still replays the search (ADR-0013 §2, §5).
    const body = SavePlanRequestSchema.safeParse(JSON.parse(draft));
    return body.success ? { studentId: studentId.data, body: body.data } : null;
  } catch {
    return null;
  }
}
