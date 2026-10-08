/**
 * @file Tests for parsing the revalidate form: valid fields, and each malformed field rejected.
 */
import { describe, expect, it } from 'vitest';

import { syntheticId } from '@caa/test-kit';

import {
  parseRevalidateForm,
  REVALIDATE_PLAN_FIELD,
  REVALIDATE_REVISION_FIELD,
  REVALIDATE_SELECTION_FIELD,
  REVALIDATE_STUDENT_FIELD,
} from './revalidate-form';

const STUDENT_ID = syntheticId('student', 1);
const PLAN_ID = syntheticId('plan', 1);

/**
 * Builds a form, letting a test override or drop a field.
 *
 * @param overrides - Field values; `null` drops the field.
 * @returns The form data.
 */
function form(overrides: Readonly<Record<string, string | null>> = {}): FormData {
  const fields: Record<string, string | null> = {
    [REVALIDATE_STUDENT_FIELD]: STUDENT_ID,
    [REVALIDATE_PLAN_FIELD]: PLAN_ID,
    [REVALIDATE_REVISION_FIELD]: '2',
    [REVALIDATE_SELECTION_FIELD]: 'true',
    ...overrides,
  };
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (value !== null) {
      data.set(name, value);
    }
  }
  return data;
}

describe('parseRevalidateForm', () => {
  it('parses the student, plan, expected revision, and selection flag', () => {
    expect(parseRevalidateForm(form())).toEqual({
      studentId: STUDENT_ID,
      planId: PLAN_ID,
      body: { expectedRevision: 2 },
      hadSelection: true,
    });
  });

  it('reads a false selection flag', () => {
    expect(parseRevalidateForm(form({ [REVALIDATE_SELECTION_FIELD]: 'false' }))?.hadSelection).toBe(
      false,
    );
  });

  it.each([
    ['a missing student', { [REVALIDATE_STUDENT_FIELD]: null }],
    ['a malformed student', { [REVALIDATE_STUDENT_FIELD]: '../x' }],
    ['a missing plan', { [REVALIDATE_PLAN_FIELD]: null }],
    ['a malformed plan', { [REVALIDATE_PLAN_FIELD]: 'nope' }],
    ['a missing revision', { [REVALIDATE_REVISION_FIELD]: null }],
    ['a zero revision', { [REVALIDATE_REVISION_FIELD]: '0' }],
    ['a fractional revision', { [REVALIDATE_REVISION_FIELD]: '1.5' }],
    ['a non-numeric revision', { [REVALIDATE_REVISION_FIELD]: 'two' }],
    ['a missing selection flag', { [REVALIDATE_SELECTION_FIELD]: null }],
    ['an unknown selection flag', { [REVALIDATE_SELECTION_FIELD]: 'maybe' }],
  ])('rejects %s', (_name, overrides) => {
    expect(parseRevalidateForm(form(overrides))).toBeNull();
  });
});
