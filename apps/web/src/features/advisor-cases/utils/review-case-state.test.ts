/**
 * @file Tests for the review form: parsing into the API's request, the failure states, and when
 * the forms are hidden.
 */
import { describe, expect, it } from 'vitest';

import { CaseAction, CaseResolution, ErrorCode } from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

import {
  hasOutcome,
  isShowingStaleCase,
  parseReviewForm,
  REVIEW_ACTION_FIELD,
  REVIEW_CASE_FIELD,
  REVIEW_NOTE_FIELD,
  REVIEW_RESOLUTION_FIELD,
  REVIEW_SEQUENCE_FIELD,
  toReviewFailedState,
} from './review-case-state';

const CASE_ID = syntheticId('advisingCase', 1);

/**
 * Builds a form.
 *
 * @param fields - Field values by name.
 * @returns The form data.
 */
function form(fields: Readonly<Record<string, string>>): FormData {
  const data = new FormData();
  data.set(REVIEW_CASE_FIELD, CASE_ID);
  data.set(REVIEW_SEQUENCE_FIELD, '2');
  for (const [name, value] of Object.entries(fields)) {
    data.set(name, value);
  }
  return data;
}

describe('parseReviewForm', () => {
  it('parses a claim and a release without a resolution or a note', () => {
    const claim = parseReviewForm(
      form({ [REVIEW_ACTION_FIELD]: 'CLAIM', [REVIEW_NOTE_FIELD]: 'x' }),
    );

    expect(claim?.request).toEqual({ action: CaseAction.Claim, expectedSequence: 2 });
    expect(parseReviewForm(form({ [REVIEW_ACTION_FIELD]: 'RELEASE' }))?.request.action).toBe(
      CaseAction.Release,
    );
  });

  it('parses a resolve with its code and a trimmed note', () => {
    const parsed = parseReviewForm(
      form({
        [REVIEW_ACTION_FIELD]: 'RESOLVE',
        [REVIEW_RESOLUTION_FIELD]: 'PLAN_REVIEWED',
        [REVIEW_NOTE_FIELD]: '  Looks fine.  ',
      }),
    );

    expect(parsed?.request).toEqual({
      action: CaseAction.Resolve,
      expectedSequence: 2,
      resolution: CaseResolution.PlanReviewed,
      note: 'Looks fine.',
    });
  });

  it('leaves a blank note out of a resolve', () => {
    const parsed = parseReviewForm(
      form({
        [REVIEW_ACTION_FIELD]: 'RESOLVE',
        [REVIEW_RESOLUTION_FIELD]: 'REFERRED_OUTSIDE_APP',
        [REVIEW_NOTE_FIELD]: '   ',
      }),
    );

    expect(parsed?.request.note).toBeUndefined();
  });

  it('refuses a resolve without a resolution code', () => {
    expect(parseReviewForm(form({ [REVIEW_ACTION_FIELD]: 'RESOLVE' }))).toBeNull();
  });

  it('refuses a note over 1,000 characters', () => {
    const parsed = parseReviewForm(
      form({
        [REVIEW_ACTION_FIELD]: 'RESOLVE',
        [REVIEW_RESOLUTION_FIELD]: 'PLAN_REVIEWED',
        [REVIEW_NOTE_FIELD]: 'a'.repeat(1001),
      }),
    );

    expect(parsed).toBeNull();
  });

  it('refuses withdraw, create, unknown actions, a bad case ID, and a bad sequence', () => {
    expect(parseReviewForm(form({ [REVIEW_ACTION_FIELD]: 'WITHDRAW' }))).toBeNull();
    expect(parseReviewForm(form({ [REVIEW_ACTION_FIELD]: 'CREATE' }))).toBeNull();
    expect(parseReviewForm(form({ [REVIEW_ACTION_FIELD]: 'DELETE' }))).toBeNull();
    expect(
      parseReviewForm(form({ [REVIEW_ACTION_FIELD]: 'CLAIM', [REVIEW_CASE_FIELD]: '../x' })),
    ).toBeNull();
    expect(
      parseReviewForm(form({ [REVIEW_ACTION_FIELD]: 'CLAIM', [REVIEW_SEQUENCE_FIELD]: '0' })),
    ).toBeNull();
    expect(parseReviewForm(new FormData())).toBeNull();
  });
});

describe('toReviewFailedState', () => {
  const base = { message: 'm', requestId: 'req-1' };

  it('maps a sequence race to changed, with the sequence that lost', () => {
    expect(toReviewFailedState({ ...base, code: ErrorCode.RevisionConflict }, 4)).toEqual({
      kind: 'changed',
      expectedSequence: 4,
    });
  });

  it('maps a 404 to gone', () => {
    expect(toReviewFailedState({ ...base, code: ErrorCode.NotFound }, 4)).toEqual({ kind: 'gone' });
  });

  it('keeps any other error as it came', () => {
    expect(toReviewFailedState({ ...base, code: ErrorCode.InternalError }, 4)).toEqual({
      kind: 'failed',
      code: ErrorCode.InternalError,
      message: 'm',
      requestId: 'req-1',
    });
  });
});

describe('isShowingStaleCase', () => {
  it('is true while the page still shows the sequence the request carried', () => {
    expect(
      isShowingStaleCase({ kind: 'done', action: CaseAction.Claim, expectedSequence: 2 }, 2),
    ).toBe(true);
    expect(isShowingStaleCase({ kind: 'changed', expectedSequence: 2 }, 2)).toBe(true);
  });

  it('is false once the page shows a newer sequence, and for other states', () => {
    expect(
      isShowingStaleCase({ kind: 'done', action: CaseAction.Claim, expectedSequence: 2 }, 3),
    ).toBe(false);
    expect(isShowingStaleCase({ kind: 'idle' }, 2)).toBe(false);
    expect(isShowingStaleCase({ kind: 'gone' }, 2)).toBe(false);
  });
});

describe('hasOutcome', () => {
  it('is true for the states that explain themselves and take focus', () => {
    expect(hasOutcome({ kind: 'done', action: CaseAction.Resolve, expectedSequence: 1 })).toBe(
      true,
    );
    expect(hasOutcome({ kind: 'changed', expectedSequence: 1 })).toBe(true);
    expect(hasOutcome({ kind: 'gone' })).toBe(true);
  });

  it('is false for idle, rejected, and failed, which use the live region', () => {
    expect(hasOutcome({ kind: 'idle' })).toBe(false);
    expect(hasOutcome({ kind: 'rejected' })).toBe(false);
    expect(
      hasOutcome({ kind: 'failed', code: ErrorCode.InternalError, message: 'm', requestId: null }),
    ).toBe(false);
  });
});
