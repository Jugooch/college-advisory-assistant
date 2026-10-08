/**
 * @file Tests for the create-case form fields: the encoded request round-trips, and anything
 * outside the contract is rejected so nothing is sent.
 */
import { describe, expect, it } from 'vitest';

import { CaseReason, DiscrepancySubject } from '@caa/domain';
import { buildPlanRevisionView, syntheticId } from '@caa/test-kit';

import { buildDiscrepancyRequest, buildPlanCaseRequest } from './case-request';
import {
  CASE_REQUEST_FIELD,
  CASE_STUDENT_FIELD,
  encodeCaseRequest,
  parseCreateCaseForm,
} from './create-case-form';

const STUDENT_ID = syntheticId('student', 1);
const REVISION_ID = buildPlanRevisionView().id;

/**
 * Builds a form.
 *
 * @param studentId - The student field.
 * @param request - The encoded request field.
 * @returns The form data.
 */
function form(studentId: string, request: string): FormData {
  const data = new FormData();
  data.set(CASE_STUDENT_FIELD, studentId);
  data.set(CASE_REQUEST_FIELD, request);
  return data;
}

describe('buildPlanCaseRequest', () => {
  it('trims the note, as the API does, and names the revision', () => {
    const request = buildPlanCaseRequest(
      CaseReason.NeedsVerification,
      REVISION_ID,
      '  Please check.  ',
    );

    expect(request).toEqual({
      reason: 'NEEDS_VERIFICATION',
      planRevisionId: REVISION_ID,
      discrepancySubject: null,
      studentNote: 'Please check.',
    });
  });
});

describe('buildDiscrepancyRequest', () => {
  it('has a subject and no plan revision', () => {
    expect(buildDiscrepancyRequest(DiscrepancySubject.Section, 'Wrong room')).toEqual({
      reason: 'SOURCE_DISCREPANCY',
      planRevisionId: null,
      discrepancySubject: 'SECTION',
      studentNote: 'Wrong room',
    });
  });
});

describe('parseCreateCaseForm', () => {
  it('round-trips an encoded request', () => {
    const body = buildDiscrepancyRequest(DiscrepancySubject.CourseAttempt, 'Missing grade');

    expect(parseCreateCaseForm(form(STUDENT_ID, encodeCaseRequest(body)))).toEqual({
      studentId: STUDENT_ID,
      body,
    });
  });

  it.each([
    ['a bad student ID', 'not-an-id', encodeCaseRequest(buildDiscrepancyRequest('SECTION', 'x'))],
    ['malformed JSON', STUDENT_ID, '{'],
    ['an empty note', STUDENT_ID, encodeCaseRequest(buildDiscrepancyRequest('SECTION', '  '))],
    [
      'a 501-character note',
      STUDENT_ID,
      encodeCaseRequest(buildDiscrepancyRequest('SECTION', 'x'.repeat(501))),
    ],
    [
      'a user ID smuggled into the body',
      STUDENT_ID,
      JSON.stringify({
        ...buildDiscrepancyRequest('SECTION', 'x'),
        userId: syntheticId('user', 1),
      }),
    ],
    [
      'a plan review with no plan',
      STUDENT_ID,
      JSON.stringify({ ...buildDiscrepancyRequest('SECTION', 'x'), reason: 'PLAN_REVIEW' }),
    ],
  ])('returns null for %s', (_name, studentId, request) => {
    expect(parseCreateCaseForm(form(studentId, request))).toBeNull();
  });

  it('returns null when a field is missing', () => {
    expect(parseCreateCaseForm(new FormData())).toBeNull();
  });
});
