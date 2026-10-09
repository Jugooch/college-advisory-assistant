/**
 * @file Tests for the failed-submission notices: each state says what happened and what to do next.
 */
// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';

import { ErrorCode } from '@caa/domain';

import { FORM_REJECTED, OPEN_CASE_EXISTS } from '@/shared/utils/case-wording';
import { describeError } from '@/shared/utils/error-code-wording';

import { CaseSubmitResult, type CaseSubmitResultProps } from './case-submit-result';

const CASES_HREF = '/help-and-cases?studentId=abc';

/**
 * Renders a state.
 *
 * @param state - The failed state.
 * @returns The container.
 */
function renderState(state: CaseSubmitResultProps['state']): HTMLElement {
  return render(<CaseSubmitResult state={state} casesHref={CASES_HREF} />).container;
}

describe('CaseSubmitResult', () => {
  afterEach(cleanup);

  it('explains the duplicate case and links to it', () => {
    const container = renderState({ kind: 'duplicate' });

    expect(container.textContent).toContain(OPEN_CASE_EXISTS);
    expect(container.textContent).toContain('Nothing new was sent.');
    expect(container.querySelector('a')?.getAttribute('href')).toBe(CASES_HREF);
    expect(container.textContent).toContain('to check where it stands');
  });

  it('explains a rejected form and that nothing was sent', () => {
    expect(renderState({ kind: 'rejected' }).textContent).toContain(FORM_REJECTED);
  });

  it.each([ErrorCode.NotFound, ErrorCode.SourceUnavailable])(
    'shows the heading, message, next step, and reference for %s',
    (code) => {
      const container = renderState({
        kind: 'failed',
        code,
        message: 'API says so',
        requestId: 'req-7',
      });

      const wording = describeError(code);
      expect(container.textContent).toContain(wording.heading);
      expect(container.textContent).toContain('API says so');
      expect(container.textContent).toContain(wording.nextStep);
      expect(container.textContent).toContain('req-7');
    },
  );

  it('omits the support reference when there is none', () => {
    const container = renderState({
      kind: 'failed',
      code: ErrorCode.NotFound,
      message: 'gone',
      requestId: null,
    });

    expect(container.textContent).not.toContain('Support reference');
  });

  it.each([
    { kind: 'duplicate' },
    { kind: 'rejected' },
    { kind: 'failed', code: ErrorCode.NotFound, message: 'gone', requestId: null },
  ] as const)('has no axe violations for $kind', async (state) => {
    const container = renderState(state);

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
