/**
 * @file Tests for the planner form's term picker: the list, the empty and unavailable states,
 * the field error, and keyboard use.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { PlannableTerm } from '@caa/api-contract';
import { TermIdSchema } from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

import { indexCourses } from '@/shared/utils/course-display';

import { planScheduleRequest } from '../utils/planner-plan';
import { readPlannerQuery } from '../utils/planner-query';
import { PlannerForm } from './planner-form';

const STUDENT_ID = syntheticId('student', 1);
const TERMS: readonly PlannableTerm[] = [
  {
    id: TermIdSchema.parse(syntheticId('term', 1)),
    termCode: 'FA-SYN',
    startsOn: '2027-01-11',
    endsOn: '2027-05-07',
  },
  {
    id: TermIdSchema.parse(syntheticId('term', 2)),
    termCode: 'SU-SYN',
    startsOn: '2027-05-24',
    endsOn: '2027-08-06',
  },
];

/**
 * Renders the form as the planner screen would.
 *
 * @param terms - The plannable terms, or null when unavailable.
 * @param query - Extra query params.
 * @param errors - Field errors by query name.
 * @returns The markup.
 */
function render(
  terms: readonly PlannableTerm[] | null,
  query: Record<string, string> = {},
  errors: ReadonlyMap<string, string> = new Map(),
): string {
  const { values } = readPlannerQuery({ studentId: STUDENT_ID, ...query });
  const plan = planScheduleRequest(values, indexCourses([]));
  return renderToStaticMarkup(
    <PlannerForm
      studentId={STUDENT_ID}
      values={values}
      errors={errors}
      candidates={[]}
      isCandidateListUnavailable={false}
      courses={indexCourses([])}
      credits={{ inputs: values.creditInputs, errors: plan.creditErrors }}
      terms={terms}
    />,
  );
}

describe('PlannerForm term picker', () => {
  it('lists each plannable term by code and dates, after a placeholder', () => {
    const html = render(TERMS);

    expect(html).toContain('>Choose a term</option>');
    expect(html).toContain(
      `<option value="${String(TERMS[0]?.id)}">FA-SYN (2027-01-11 to 2027-05-07)</option>`,
    );
    expect(html).toContain(
      `<option value="${String(TERMS[1]?.id)}">SU-SYN (2027-05-24 to 2027-08-06)</option>`,
    );
  });

  it('keeps the chosen term selected', () => {
    expect(render(TERMS, { term: TERMS[1]?.id ?? '' })).toMatch(
      /<option value="[^"]*" selected="">SU-SYN/,
    );
  });

  it('never calls a term registered', () => {
    expect(render(TERMS).toLowerCase()).not.toMatch(/registered for|you are registered/);
    expect(render(TERMS)).toContain('does not register you');
  });

  it('shows the advisor referral instead of a picker when no term is plannable', () => {
    const html = render([]);

    expect(html).toContain('Ask your advisor which term to plan for.');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('<form');
  });

  it('says the list is unavailable, with no picker, when it could not be loaded', () => {
    const html = render(null);

    expect(html).toContain('couldn’t be listed right now');
    expect(html).toContain('ask your advisor');
    expect(html).not.toContain('<select');
  });

  it('shows the field error linked to the select', () => {
    const html = render(TERMS, {}, new Map([['term', 'Choose the term you are planning for.']]));

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="planner-term-hint planner-term-error"');
    expect(html).toContain('<p id="planner-term-error" class="field-error">Choose');
  });

  it('is a labelled native select, reachable and operable by keyboard', () => {
    const html = render(TERMS);

    expect(html).toContain('<label for="planner-term">Term</label>');
    expect(html).toMatch(/<select id="planner-term" name="term"/);
    expect(html).not.toMatch(/<select[^>]*tabindex/);
    expect(html).not.toMatch(/<select[^>]*disabled/);
  });
});
