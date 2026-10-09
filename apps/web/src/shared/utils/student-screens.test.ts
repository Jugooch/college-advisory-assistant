/**
 * @file Tests for the student screen links.
 */
import { describe, expect, it } from 'vitest';

import { STUDENT_SCREENS, studentScreenHref } from './student-screens';

describe('studentScreenHref', () => {
  it('builds the path with the encoded student query', () => {
    expect(studentScreenHref('my-plans', 'DEMO/S 01')).toBe('/my-plans?studentId=DEMO%2FS+01');
  });

  it('has a path for every listed screen', () => {
    for (const { screen, path } of STUDENT_SCREENS) {
      expect(studentScreenHref(screen, 's1')).toBe(`${path}?studentId=s1`);
    }
  });
});
