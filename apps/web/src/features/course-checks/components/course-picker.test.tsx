/**
 * @file Tests for the course picker's labels, selection, credit fields, and errors.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { CourseDisplay } from '@caa/api-contract';
import { SYNTHETIC_COURSES, syntheticId } from '@caa/test-kit';

import { indexCourses } from '@/shared/utils/course-display';
import type { CreditChoices } from '@/shared/utils/credit-choice';

import { CoursePicker, type CoursePickerProps } from './course-picker';

const STUDENT_ID = syntheticId('student', 1);
const { math101, math102, ind390 } = SYNTHETIC_COURSES;
const CANDIDATES = [
  { courseId: math101.id, requirementLabels: ['Core'] },
  { courseId: math102.id, requirementLabels: ['Core', 'Elective'] },
  { courseId: ind390.id, requirementLabels: ['Elective'] },
];

/** Catalog entries for DEMO-MATH 102 (fixed) and DEMO-IND 390 (variable); none for math101. */
const DISPLAY: readonly CourseDisplay[] = [
  {
    courseId: math102.id,
    code: 'DEMO-MATH 102',
    title: 'Demo Calculus II',
    credits: { kind: 'FIXED', creditsHundredths: 300 },
  },
  {
    courseId: ind390.id,
    code: 'DEMO-IND 390',
    title: null,
    credits: { kind: 'VARIABLE', minCreditsHundredths: 100, maxCreditsHundredths: 300 },
  },
];
const NO_CREDITS: CreditChoices = { inputs: new Map(), errors: new Map() };

/**
 * Renders the picker with the three candidates and their catalog entries.
 *
 * @param overrides - Props to change.
 * @returns The markup.
 */
function render(overrides: Partial<CoursePickerProps> = {}): string {
  return renderToStaticMarkup(
    <CoursePicker
      studentId={STUDENT_ID}
      candidates={CANDIDATES}
      selectedCourseIds={[]}
      isCandidateListUnavailable={false}
      selectionError={null}
      courses={indexCourses(DISPLAY)}
      credits={NO_CREDITS}
      {...overrides}
    />,
  );
}

/**
 * Finds the input tag with one `name` and `value`, or one `id`.
 *
 * @param html - Rendered markup.
 * @param attribute - For example `value="<id>"` or `id="pick-credits-<id>"`.
 * @returns The `<input …>` tag, or an empty string.
 */
function inputWith(html: string, attribute: string): string {
  return new RegExp(`<input[^>]*${attribute}[^>]*>`).exec(html)?.[0] ?? '';
}

describe('CoursePicker', () => {
  it('labels each checkbox with the catalog code and describes its listing and credits', () => {
    const html = render();

    expect(html).toContain(
      `<label for="pick-course-${math102.id}">DEMO-MATH 102 (Demo Calculus II)</label>`,
    );
    expect(html).toContain(`aria-describedby="pick-course-${math102.id}-listed"`);
    expect(html).toContain('Listed for: Core, Elective. 3 credits.');
    expect(html).toContain('Listed for: Elective. 1 to 3 credits, your choice.');
  });

  it('labels a course with no catalog entry by its ID and says so', () => {
    const html = render();

    expect(html).toContain(
      `<label for="pick-course-${math101.id}">Course <code>${math101.id}</code> (no catalog details available)</label>`,
    );
    expect(html).toContain('Listed for: Core.</span>');
  });

  it('offers a blank, labelled credit field only for the variable-credit course', () => {
    const html = render();
    const field = inputWith(html, `id="pick-credits-${ind390.id}"`);

    expect(html).toContain(
      `<label for="pick-credits-${ind390.id}">Credits for DEMO-IND 390 (title not available)</label>`,
    );
    expect(field).toContain(`name="credits-${ind390.id}"`);
    expect(field).toContain('value=""');
    expect(field).toContain(`aria-describedby="pick-credits-${ind390.id}-hint"`);
    expect(field).toContain('aria-invalid="false"');
    expect(html).toContain('Enter 1 to 3. If you leave it blank, the credit load is shown as');
    expect(html.match(/pick-credits-[^"]*"/g)?.every((id) => id.includes(ind390.id))).toBe(true);
  });

  it('keeps the typed value and links its error to the field', () => {
    const html = render({
      selectionError: 'Fix the credit value marked below, then check again.',
      credits: {
        inputs: new Map([[ind390.id, '4']]),
        errors: new Map([[ind390.id, 'Enter a number from 1 to 3.']]),
      },
    });
    const field = inputWith(html, `id="pick-credits-${ind390.id}"`);

    expect(field).toContain('value="4"');
    expect(field).toContain(
      `aria-describedby="pick-credits-${ind390.id}-hint pick-credits-${ind390.id}-error"`,
    );
    expect(field).toContain('aria-invalid="true"');
    expect(html).toContain(
      `<p id="pick-credits-${ind390.id}-error" class="field-error">Enter a number from 1 to 3.</p>`,
    );
  });

  it('offers no credit field when the candidate list is unavailable', () => {
    const html = render({ isCandidateListUnavailable: true });

    expect(html).not.toContain('pick-credits-');
    expect(html).toContain('Credit values can be chosen once your record loads.');
  });

  it('keeps the last selection checked', () => {
    const html = render({ selectedCourseIds: [math101.id] });

    expect(inputWith(html, `value="${math101.id}"`)).toContain('checked=""');
    expect(inputWith(html, `value="${math102.id}"`)).not.toBe('');
    expect(inputWith(html, `value="${math102.id}"`)).not.toContain('checked');
  });

  it('links the selection error to the course group', () => {
    const html = render({ selectionError: 'Choose at least one course.' });

    expect(html).toContain('<fieldset aria-describedby="picker-hint picker-error">');
    expect(html).toContain('>Choose at least one course.</p>');
  });

  it('gives a next step when the audit lists no candidates', () => {
    const html = render({ candidates: [] });

    expect(html).toContain('Ask your advisor which courses to plan for.');
    expect(html).not.toContain('<form');
  });

  it('says the list is unavailable, not empty, when the record did not load', () => {
    const html = render({ candidates: [], isCandidateListUnavailable: true });

    expect(html).toContain('Candidate courses can’t be listed until your record loads.');
  });
});
