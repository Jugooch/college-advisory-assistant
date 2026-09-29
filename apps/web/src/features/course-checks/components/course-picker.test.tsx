/**
 * @file Tests for the course picker's labels, selection, and errors.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SYNTHETIC_COURSES, syntheticId } from '@caa/test-kit';

import { CoursePicker } from './course-picker';

const STUDENT_ID = syntheticId('student', 1);
const { math101, math102 } = SYNTHETIC_COURSES;
const CANDIDATES = [
  { courseId: math101.id, requirementLabels: ['Core'] },
  { courseId: math102.id, requirementLabels: ['Core', 'Elective'] },
];

/**
 * Finds the checkbox tag for one course.
 *
 * @param html - Rendered markup.
 * @param courseId - The course's ID.
 * @returns The `<input …>` tag, or an empty string.
 */
function checkboxFor(html: string, courseId: string): string {
  return new RegExp(`<input[^>]*value="${courseId}"[^>]*>`).exec(html)?.[0] ?? '';
}

describe('CoursePicker', () => {
  it('labels each checkbox and describes the requirements that list it', () => {
    const html = renderToStaticMarkup(
      <CoursePicker
        studentId={STUDENT_ID}
        candidates={CANDIDATES}
        selectedCourseIds={[]}
        isCandidateListUnavailable={false}
        selectionError={null}
      />,
    );

    expect(html).toContain(
      `<label for="pick-course-${math102.id}">Course <code>${math102.id}</code>`,
    );
    expect(html).toContain(`aria-describedby="pick-course-${math102.id}-listed"`);
    expect(html).toContain('Listed for: Core, Elective');
  });

  it('keeps the last selection checked', () => {
    const html = renderToStaticMarkup(
      <CoursePicker
        studentId={STUDENT_ID}
        candidates={CANDIDATES}
        selectedCourseIds={[math101.id]}
        isCandidateListUnavailable={false}
        selectionError={null}
      />,
    );

    expect(checkboxFor(html, math101.id)).toContain('checked=""');
    expect(checkboxFor(html, math102.id)).not.toBe('');
    expect(checkboxFor(html, math102.id)).not.toContain('checked');
  });

  it('links the selection error to the course group', () => {
    const html = renderToStaticMarkup(
      <CoursePicker
        studentId={STUDENT_ID}
        candidates={CANDIDATES}
        selectedCourseIds={[]}
        isCandidateListUnavailable={false}
        selectionError="Choose at least one course."
      />,
    );

    expect(html).toContain('<fieldset aria-describedby="picker-hint picker-error">');
    expect(html).toContain('>Choose at least one course.</p>');
  });

  it('gives a next step when the audit lists no candidates', () => {
    const html = renderToStaticMarkup(
      <CoursePicker
        studentId={STUDENT_ID}
        candidates={[]}
        selectedCourseIds={[]}
        isCandidateListUnavailable={false}
        selectionError={null}
      />,
    );

    expect(html).toContain('Ask your advisor which courses to plan for.');
    expect(html).not.toContain('<form');
  });

  it('says the list is unavailable, not empty, when the record did not load', () => {
    const html = renderToStaticMarkup(
      <CoursePicker
        studentId={STUDENT_ID}
        candidates={[]}
        isCandidateListUnavailable
        selectedCourseIds={[]}
        selectionError={null}
      />,
    );

    expect(html).toContain('Candidate courses can’t be listed until your record loads.');
  });
});
