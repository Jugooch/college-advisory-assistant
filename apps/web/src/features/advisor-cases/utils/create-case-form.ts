/**
 * @file Builds, encodes, and parses the create-case request. The preview, the hidden field, and
 * the server action all use the same request, so what the student sees is what is sent.
 * @module @caa/web/features/advisor-cases/utils/create-case-form
 * @requirement FR-12
 * @requirement FR-17
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { type CreateCaseRequest, CreateCaseRequestSchema } from '@caa/api-contract';
import { type StudentId, StudentIdSchema } from '@caa/domain';

/** Form field that carries the encoded {@link CreateCaseRequest}. */
export const CASE_REQUEST_FIELD = 'caseRequest';

/** Form field that carries the internal student ID from the page URL. */
export const CASE_STUDENT_FIELD = 'studentId';

/** A parsed create-case form. */
export interface CreateCaseForm {
  readonly studentId: StudentId;
  readonly body: CreateCaseRequest;
}

/**
 * Encodes the create-case request for a hidden form field.
 *
 * @param body - The request to send.
 * @returns A JSON string.
 */
export function encodeCaseRequest(body: CreateCaseRequest): string {
  return JSON.stringify(body);
}

/**
 * Parses a submitted create-case form.
 *
 * @param formData - The submitted form.
 * @returns The student and request, or `null` when either field is missing or doesn't parse. The
 *   note is trimmed and bounded to 500 characters by the contract schema.
 */
export function parseCreateCaseForm(formData: FormData): CreateCaseForm | null {
  const studentId = StudentIdSchema.safeParse(formData.get(CASE_STUDENT_FIELD));
  const encoded = formData.get(CASE_REQUEST_FIELD);
  if (!studentId.success || typeof encoded !== 'string') {
    return null;
  }
  try {
    // SECURITY: the field is external input, so the contract schema parses it. It is strict, so a
    // tenant, user, role, owner, or status in the body is rejected (FR-01).
    const body = CreateCaseRequestSchema.safeParse(JSON.parse(encoded));
    return body.success ? { studentId: studentId.data, body: body.data } : null;
  } catch {
    return null;
  }
}
