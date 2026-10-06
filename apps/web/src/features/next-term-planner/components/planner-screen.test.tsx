/**
 * @file Tests for the planner screen: the strength toggle, the review step, and the validation
 * errors.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ApiError } from '@caa/api-contract';
import { ErrorCode, TermIdSchema } from '@caa/domain';
import { SYNTHETIC_COURSES, syntheticId } from '@caa/test-kit';

import { indexCourses } from '@/shared/utils/course-display';

import { planScheduleRequest } from '../utils/planner-plan';
import { readPlannerQuery, type SearchParams } from '../utils/planner-query';
import { planPlannerView } from '../utils/planner-view';
import { PlannerScreen } from './planner-screen';

const STUDENT_ID = syntheticId('student', 1);
const { math101 } = SYNTHETIC_COURSES;
const TERM = {
  id: TermIdSchema.parse(syntheticId('term', 1)),
  termCode: 'FA-SYN',
  startsOn: '2027-01-11',
  endsOn: '2027-05-07',
} as const;
const BASE: SearchParams = {
  studentId: STUDENT_ID,
  term: syntheticId('term', 1),
  course: math101.id,
};

/**
 * Renders the screen for the query, as the page would.
 *
 * @param extra - Query params to add to a valid term and course.
 * @param step - The requested step.
 * @param outcome - The search outcome, or null.
 * @returns The markup.
 */
function render(extra: SearchParams, step: string, outcome: ApiError | null = null): string {
  const { values } = readPlannerQuery({ ...BASE, ...extra, step });
  const plan = planScheduleRequest(values, indexCourses([]));
  const view = planPlannerView(readPlannerQuery({ step }).step, plan, outcome);
  return renderToStaticMarkup(
    <PlannerScreen
      studentId={STUDENT_ID}
      view={view}
      values={values}
      candidates={[{ courseId: math101.id, requirementLabels: ['Core'] }]}
      isCandidateListUnavailable={false}
      courses={indexCourses([])}
      credits={{ inputs: values.creditInputs, errors: plan.creditErrors }}
      terms={[TERM]}
    />,
  );
}

describe('PlannerScreen form', () => {
  const html = render({}, 'edit');

  it('defaults every constraint to preferred, and offers required as an explicit choice', () => {
    expect(html).toMatch(/<input[^>]*name="block1-strength"[^>]*checked=""[^>]*value="PREFERRED"/);
    expect(html).not.toMatch(/<input[^>]*checked=""[^>]*value="HARD"/);
    expect(html).toContain('>Required</label>');
  });

  it('groups weekdays in a labelled fieldset and submits to the review step with GET', () => {
    expect(html).toContain('<legend>Days</legend>');
    expect(html).toContain('method="get"');
    expect(html).toContain('value="review" name="step"');
    expect(html).not.toContain('value="search" name="step"');
  });

  it('checks Required only when the student chose it', () => {
    const chosen = render({ 'block1-strength': 'HARD' }, 'edit');

    expect(chosen).toMatch(/<input[^>]*name="block1-strength"[^>]*checked=""[^>]*value="HARD"/);
  });
});

describe('PlannerScreen validation errors', () => {
  it('lists a contradiction in an alert and links the field error to its input', () => {
    const html = render(
      { 'credit-range-min': '15', 'credit-range-max': '12', 'credit-range-strength': 'HARD' },
      'review',
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('href="#planner-credit-range-min"');
    expect(html).toMatch(/id="planner-credit-range-min"[^>]*aria-invalid="true"/);
    expect(html).toContain(
      'aria-describedby="planner-credit-range-min-hint planner-credit-range-min-error"',
    );
    expect(html).toContain('id="planner-credit-range-min-error"');
    expect(html).toContain('Nothing was changed for you.');
  });

  it('keeps what the student typed in the form', () => {
    const html = render({ 'credit-range-min': '15', 'credit-range-max': '12' }, 'review');

    expect(html).toContain('value="15"');
    expect(html).toContain('value="12"');
  });
});

describe('PlannerScreen review', () => {
  it('says every constraint in words with its strength, as text and not color', () => {
    const html = render(
      { 'block1-day': 'FRIDAY', 'credit-range-max': '15', 'credit-range-strength': 'HARD' },
      'review',
    );

    expect(html).toContain(
      '<strong>Preferred, priority 1:</strong> Not available on Friday, all day.',
    );
    expect(html).toContain('<strong>Required:</strong> Take at most 15 credits.');
  });

  it('confirms with a search button and carries every value in hidden fields', () => {
    const html = render({ 'block1-day': 'FRIDAY' }, 'review');

    expect(html).toContain('value="search" name="step"');
    expect(html).toContain('Confirm and find schedules');
    expect(html).toContain('<input type="hidden" name="block1-day" value="FRIDAY"/>');
    expect(html).toContain('<input type="hidden" name="block1-strength" value=""/>');
    expect(html).toContain(`<input type="hidden" name="course" value="${math101.id}"/>`);
  });

  it('keeps the confirmed constraints when the search fails, and offers a retry', () => {
    const error = new ApiError({
      code: ErrorCode.SourceUnavailable,
      status: 503,
      message: 'The source is unavailable.',
      requestId: 'req-syn-001',
    });

    const html = render({ 'block1-day': 'FRIDAY', 'block1-strength': 'HARD' }, 'search', error);

    expect(html).toContain('req-syn-001');
    expect(html).toContain('Try the search again');
    expect(html).toContain('<strong>Required:</strong> Not available on Friday, all day.');
    expect(html).toContain('<input type="hidden" name="block1-strength" value="HARD"/>');
  });

  it('says plainly when no constraints were stated', () => {
    expect(render({}, 'review')).toContain('You stated no constraints');
  });
});
