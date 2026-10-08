/**
 * @file Tests for the save-draft form: the section IDs sent for an option, the encoding, and
 * the parse that rejects anything that isn't a valid save request.
 */
import { describe, expect, it } from 'vitest';

import { ScheduleOptionsRequestSchema } from '@caa/api-contract';
import {
  buildScheduleConstraintSet,
  buildScheduleOption,
  buildScheduleOptionsResponse,
  syntheticId,
} from '@caa/test-kit';

import { optionSectionIds } from '@/shared/utils/option-section-ids';

import { DRAFT_FIELD, encodeSaveDraft, parseSaveDraftForm, STUDENT_FIELD } from './save-draft-form';

const STUDENT_ID = syntheticId('student', 1);
const RESULT = buildScheduleOptionsResponse();
const OPTION = buildScheduleOption();
const REQUEST = ScheduleOptionsRequestSchema.parse({
  termId: RESULT.term.id,
  courseIds: RESULT.courseIds,
  creditSelections: [],
  constraints: buildScheduleConstraintSet(),
});

/**
 * Builds a submitted form.
 *
 * @param fields - Field values by name.
 * @returns The form data.
 */
function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(fields).forEach(([name, value]) => {
    data.set(name, value);
  });
  return data;
}

describe('parseSaveDraftForm', () => {
  const body = {
    request: REQUEST,
    selectedSectionIds: optionSectionIds(OPTION),
    expectedPinnedInputs: RESULT.pinnedInputs,
  };

  it('round-trips the exact request, sections, and pinned inputs', () => {
    const parsed = parseSaveDraftForm(
      form({ [STUDENT_FIELD]: STUDENT_ID, [DRAFT_FIELD]: encodeSaveDraft(body) }),
    );

    expect(parsed).toEqual({ studentId: STUDENT_ID, body });
  });

  it('accepts a result with no options as a null selection', () => {
    const none = { ...body, selectedSectionIds: null };

    const parsed = parseSaveDraftForm(
      form({ [STUDENT_FIELD]: STUDENT_ID, [DRAFT_FIELD]: encodeSaveDraft(none) }),
    );

    expect(parsed?.body.selectedSectionIds).toBeNull();
  });

  it.each([
    ['a missing draft', { [STUDENT_FIELD]: STUDENT_ID }],
    ['a missing student', { [DRAFT_FIELD]: encodeSaveDraft(body) }],
    ['a malformed student ID', { [STUDENT_FIELD]: '../x', [DRAFT_FIELD]: encodeSaveDraft(body) }],
    ['text that isn’t JSON', { [STUDENT_FIELD]: STUDENT_ID, [DRAFT_FIELD]: '{nope' }],
    [
      'a body naming a tenant',
      { [STUDENT_FIELD]: STUDENT_ID, [DRAFT_FIELD]: JSON.stringify({ ...body, tenantId: 'x' }) },
    ],
  ])('returns null for %s', (_name, fields) => {
    expect(parseSaveDraftForm(form(fields))).toBeNull();
  });
});
