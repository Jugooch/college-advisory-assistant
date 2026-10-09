// @vitest-environment jsdom
/**
 * @file Tests for reading the planner form's live values over the page query.
 */
import { describe, expect, it } from 'vitest';

import { readLivePlannerQuery } from './live-planner-query';

/**
 * Builds a form from its markup.
 *
 * @param html - The inner markup.
 * @returns The form element.
 */
function formOf(html: string): HTMLFormElement {
  const form = document.createElement('form');
  form.innerHTML = html;
  return form;
}

describe('readLivePlannerQuery', () => {
  it('returns a copy of the page query when there is no form', () => {
    const current = new URLSearchParams('term=t1');
    const result = readLivePlannerQuery(current, null);
    expect(result.toString()).toBe('term=t1');
    expect(result).not.toBe(current);
  });

  it('lets the form hold what the student typed or unchecked, and keeps other values', () => {
    const form = formOf(
      '<input name="term" value="t1">' +
        '<input type="checkbox" name="block1-day" value="MONDAY" checked>' +
        '<input type="checkbox" name="block2-day" value="FRIDAY">' +
        '<input name="block1-start" value="09:00">',
    );
    const current = new URLSearchParams('studentId=s1&term=old&block2-day=FRIDAY');
    const result = readLivePlannerQuery(current, form);
    expect(result.get('studentId')).toBe('s1');
    expect(result.get('term')).toBe('t1');
    expect(result.getAll('block1-day')).toEqual(['MONDAY']);
    expect(result.has('block2-day')).toBe(false);
    expect(result.get('block1-start')).toBe('09:00');
  });
});
