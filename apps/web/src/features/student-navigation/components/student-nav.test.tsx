/**
 * @file Tests for the student navigation landmark.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { syntheticId } from '@caa/test-kit';

import { StudentNav } from './student-nav';

const STUDENT_ID = syntheticId('student', 1);

describe('StudentNav', () => {
  it('links both screens for the student and marks only the current one', () => {
    const html = renderToStaticMarkup(
      <StudentNav studentId={STUDENT_ID} current="course-checks" />,
    );

    expect(html).toContain('<nav aria-label="Student">');
    expect(html).toContain(`<a href="/overview?studentId=${STUDENT_ID}">Overview</a>`);
    expect(html).toContain(
      `<a aria-current="page" href="/course-checks?studentId=${STUDENT_ID}">Course checks</a>`,
    );
  });
});
