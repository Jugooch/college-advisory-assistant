/**
 * @file Tests that a course is labelled by catalog code and title, or by ID with a plain note.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SYNTHETIC_COURSES } from '@caa/test-kit';

import { indexCourses } from '@/shared/utils/course-display';

import { CourseLabel } from './course-label';

const { ind390 } = SYNTHETIC_COURSES;
const COURSES = indexCourses([
  {
    courseId: ind390.id,
    code: 'DEMO-IND 390',
    title: 'Demo Independent Study',
    credits: { kind: 'VARIABLE', minCreditsHundredths: 100, maxCreditsHundredths: 300 },
  },
]);

describe('CourseLabel', () => {
  it('shows the code and the title', () => {
    expect(renderToStaticMarkup(<CourseLabel courseId={ind390.id} courses={COURSES} />)).toBe(
      'DEMO-IND 390 (Demo Independent Study)',
    );
  });

  it('shows the ID and says no catalog details are available', () => {
    expect(
      renderToStaticMarkup(<CourseLabel courseId={ind390.id} courses={indexCourses()} />),
    ).toBe(`Course <code>${ind390.id}</code> (no catalog details available)`);
  });

  it('says the title is not available when it is null', () => {
    const untitled = indexCourses([
      {
        courseId: ind390.id,
        code: 'DEMO-IND 390',
        title: null,
        credits: { kind: 'FIXED', creditsHundredths: 100 },
      },
    ]);
    expect(renderToStaticMarkup(<CourseLabel courseId={ind390.id} courses={untitled} />)).toBe(
      'DEMO-IND 390 (title not available)',
    );
  });
});
