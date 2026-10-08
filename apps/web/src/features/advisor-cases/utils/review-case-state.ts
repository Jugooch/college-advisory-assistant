/**
 * @file The review form: its fields, how a submission is parsed into the API's request, and the
 * state the screen shows afterward.
 * @module @caa/web/features/advisor-cases/utils/review-case-state
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { type ApiError, type CaseEventRequest, CaseEventRequestSchema } from '@caa/api-contract';
import { CaseAction, type CaseId, CaseIdSchema, ErrorCode } from '@caa/domain';

/** Form field that carries the case ID. */
export const REVIEW_CASE_FIELD = 'caseId';

/** Form field that carries the `lastSequence` the page showed. */
export const REVIEW_SEQUENCE_FIELD = 'expectedSequence';

/** Form field that carries the action: claim, release, or resolve. */
export const REVIEW_ACTION_FIELD = 'action';

/** Form field that carries the resolution code. */
export const REVIEW_RESOLUTION_FIELD = 'resolution';

/** Form field that carries the note the student will read. */
export const REVIEW_NOTE_FIELD = 'note';

/** The actions an advisor can take from this screen. */
export const REVIEW_ACTIONS = [CaseAction.Claim, CaseAction.Release, CaseAction.Resolve] as const;

/** One of {@link REVIEW_ACTIONS}. */
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

/** What the review screen shows. Every field is serializable. */
export type ReviewCaseState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'done'; readonly action: ReviewAction; readonly expectedSequence: number }
  | { readonly kind: 'changed'; readonly expectedSequence: number }
  | { readonly kind: 'gone' }
  | { readonly kind: 'rejected' }
  | {
      readonly kind: 'failed';
      readonly code: ApiError['code'];
      readonly message: string;
      readonly requestId: string | null;
    };

/** The state before anything is submitted. */
export const IDLE_REVIEW_STATE: ReviewCaseState = { kind: 'idle' };

/** A parsed review form. */
export interface ReviewCaseForm {
  readonly caseId: CaseId;
  /** The action the request carries, narrowed to the three this screen offers. */
  readonly action: ReviewAction;
  readonly request: CaseEventRequest;
}

/**
 * Reads a form field as text.
 *
 * @param formData - The submitted form.
 * @param name - The field name.
 * @returns The text, or `undefined` for a missing field or a file.
 */
function readText(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === 'string' ? value : undefined;
}

/**
 * Reads the sequence field as a positive whole number.
 *
 * @param formData - The submitted form.
 * @returns The sequence, or `null` when it is missing or not a number.
 */
function readSequence(formData: FormData): number | null {
  const raw = readText(formData, REVIEW_SEQUENCE_FIELD);
  return raw !== undefined && /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : null;
}

/**
 * Builds the request body a form describes. A resolution and a note belong to RESOLVE only, and a
 * blank note is left out.
 *
 * @param formData - The submitted form.
 * @param action - The action being sent.
 * @param expectedSequence - The sequence the page showed.
 * @returns The unvalidated body.
 */
function buildBody(
  formData: FormData,
  action: ReviewAction,
  expectedSequence: number,
): Record<string, unknown> {
  if (action !== CaseAction.Resolve) {
    return { action, expectedSequence };
  }
  const note = (readText(formData, REVIEW_NOTE_FIELD) ?? '').trim();
  return {
    action,
    expectedSequence,
    resolution: readText(formData, REVIEW_RESOLUTION_FIELD),
    ...(note === '' ? {} : { note }),
  };
}

/**
 * Parses a submitted review form. The request is checked against the API's own schema, so a
 * resolution is only ever sent with RESOLVE.
 *
 * @param formData - The submitted form.
 * @returns The case and the request, or `null` when anything doesn't parse.
 */
export function parseReviewForm(formData: FormData): ReviewCaseForm | null {
  const caseId = CaseIdSchema.safeParse(readText(formData, REVIEW_CASE_FIELD));
  const sequence = readSequence(formData);
  const rawAction = readText(formData, REVIEW_ACTION_FIELD);
  const action = REVIEW_ACTIONS.find((each) => each === rawAction);
  if (!caseId.success || sequence === null || action === undefined) {
    return null;
  }
  const request = CaseEventRequestSchema.safeParse(buildBody(formData, action, sequence));
  return request.success ? { caseId: caseId.data, action, request: request.data } : null;
}

/**
 * Builds the screen state for an API error.
 *
 * @param error - The error envelope.
 * @param expectedSequence - The sequence the failed request carried.
 * @returns `changed` for 409 `REVISION_CONFLICT`, `gone` for 404, otherwise the error itself.
 */
export function toReviewFailedState(
  error: Pick<ApiError, 'code' | 'message' | 'requestId'>,
  expectedSequence: number,
): ReviewCaseState {
  if (error.code === ErrorCode.RevisionConflict) {
    return { kind: 'changed', expectedSequence };
  }
  if (error.code === ErrorCode.NotFound) {
    return { kind: 'gone' };
  }
  return { kind: 'failed', code: error.code, message: error.message, requestId: error.requestId };
}

/**
 * Returns whether the screen should hide the action forms: an action just went through, or the
 * case changed, and the page has not yet shown the newer version.
 *
 * @param state - The review state.
 * @param lastSequence - The `lastSequence` the page currently shows.
 * @returns `true` while the page still shows the sequence the last request carried.
 */
export function isShowingStaleCase(state: ReviewCaseState, lastSequence: number): boolean {
  return (
    (state.kind === 'done' || state.kind === 'changed') && state.expectedSequence === lastSequence
  );
}

/**
 * Returns whether a state has an outcome message that takes focus: an action went through, the
 * case changed under the reviewer, or it is no longer available.
 *
 * @param state - The review state.
 * @returns `true` for done, changed, and gone.
 */
export function hasOutcome(state: ReviewCaseState): boolean {
  return state.kind === 'done' || state.kind === 'changed' || state.kind === 'gone';
}
