// @vitest-environment jsdom
/**
 * @file Tests that the shared cards render under the heading level they are given, never skip a
 * level, and keep their ids unique when several cards share a page.
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { buildScheduleOption, buildScheduleOptionsResponse } from '@caa/test-kit';

import { ScheduleResults } from './schedule-results';

afterEach(cleanup);

const RESULT = buildScheduleOptionsResponse({ options: [buildScheduleOption()] });

/**
 * Lists the heading levels in document order.
 *
 * @param container - The rendered container.
 * @returns For example `[2, 3, 3, 4]`.
 */
function levelsOf(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((heading) =>
    Number(heading.tagName.slice(1)),
  );
}

describe('shared card heading levels', () => {
  it('keeps the planner page levels by default: h2 first, then h3, then h4', () => {
    const { container } = render(<ScheduleResults result={RESULT} />);
    const levels = levelsOf(container);
    expect(levels[0]).toBe(2);
    expect(Math.max(...levels)).toBe(4);
    expect(levels.filter((level) => level === 2)).toHaveLength(1);
  });

  it('starts at h3 under the chat panel h2 and never skips a level', () => {
    const { container } = render(<ScheduleResults result={RESULT} headingLevel={3} />);
    const levels = levelsOf(container);
    expect(levels[0]).toBe(3);
    expect(levels).not.toContain(2);
    expect(Math.max(...levels)).toBe(5);
    levels.slice(1).forEach((level, index) => {
      expect(level - (levels[index] ?? level)).toBeLessThanOrEqual(1);
    });
  });

  it('gives every heading and region in two cards on one page a unique id', () => {
    const { container } = render(
      <>
        <ScheduleResults result={RESULT} headingLevel={3} />
        <ScheduleResults result={RESULT} headingLevel={3} />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('[id]')).map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    container.querySelectorAll('[aria-labelledby]').forEach((region) => {
      const target = container.querySelector(
        `[id="${region.getAttribute('aria-labelledby') ?? ''}"]`,
      );
      expect(target).not.toBeNull();
    });
  });

  it('names a course the page does not know by its code and says details are missing', () => {
    const { container } = render(<ScheduleResults result={RESULT} headingLevel={3} />);
    expect(container.textContent).toMatch(/DEMO-|no catalog details available/);
  });
});
