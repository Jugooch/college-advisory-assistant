/**
 * @file Tests for the preview's check list: an undecided search is never worded as "no failures",
 * and omitted conflicts are counted.
 */
// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CheckKind, CheckState, ReasonCode } from '@caa/domain';

import type { SharedChecks } from '../utils/shared-checks';
import { NO_FAILING_CHECKS, SEARCH_INCOMPLETE, SharedChecksList } from './shared-checks-list';

const COURSES = new Map();

/**
 * Renders the list.
 *
 * @param checks - The checks to show.
 * @returns The text content.
 */
function textOf(checks: SharedChecks): string {
  return render(<SharedChecksList checks={checks} courses={COURSES} />).container.textContent;
}

describe('SharedChecksList', () => {
  afterEach(cleanup);

  it('says an unfinished search is undecided, not that nothing failed', () => {
    const text = textOf({ kind: 'incomplete', checks: [] });

    expect(text).toBe(SEARCH_INCOMPLETE);
    expect(text).not.toContain(NO_FAILING_CHECKS);
  });

  it('lists a failing conflict and the number left out', () => {
    const text = textOf({
      kind: 'listed',
      omittedCount: 2,
      checks: [
        {
          key: '0',
          kind: CheckKind.ScheduleFeasibility,
          courseId: null,
          state: CheckState.Fail,
          reasonCode: ReasonCode.UnavailableTimeConflict,
        },
      ],
    });

    expect(text).toContain('Schedule');
    expect(text).toContain('2 more conflicts are not listed here.');
    expect(text).not.toContain(NO_FAILING_CHECKS);
  });
});
