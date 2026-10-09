/**
 * @file Tests for the Overview's case status: the open case in words, none when there is no open
 * case, the links, and axe.
 */
// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';

import { CaseStatus } from '@caa/domain';
import { buildCaseView } from '@caa/test-kit';

import { describeCaseStatus } from '@/shared/utils/case-wording';

import type { CaseSummary } from '../utils/case-summary';
import { NO_OPEN_CASES, OpenCaseSummary } from './open-case-summary';

/**
 * Builds a list row.
 *
 * @param status - The row's status.
 * @param seed - Distinguishes rows.
 * @returns The summary.
 */
function row(status: CaseStatus, seed = 1): CaseSummary {
  const view = buildCaseView({}, seed);
  return {
    id: view.id,
    reason: view.reason,
    planRevisionId: view.planRevisionId,
    discrepancySubject: null,
    status,
    createdAt: view.createdAt,
  };
}

/**
 * Renders the summary.
 *
 * @param cases - The case rows.
 * @returns The container.
 */
function renderSummary(cases: readonly CaseSummary[]): HTMLElement {
  return render(
    <OpenCaseSummary
      cases={cases}
      casesHref="/help-and-cases?studentId=a"
      reportHref="/report-a-problem?studentId=a"
    />,
  ).container;
}

describe('OpenCaseSummary', () => {
  afterEach(cleanup);

  it.each([CaseStatus.Open, CaseStatus.InReview])(
    'shows an %s case with its status and next step',
    (status) => {
      const container = renderSummary([row(status)]);

      const wording = describeCaseStatus(status);
      expect(container.textContent).toContain(wording.label);
      expect(container.textContent).toContain(wording.nextStep);
      expect(container.textContent).not.toContain(NO_OPEN_CASES);
    },
  );

  it.each([CaseStatus.Resolved, CaseStatus.Withdrawn])(
    'does not count a %s case as open',
    (status) => {
      const container = renderSummary([row(status)]);

      expect(container.textContent).toContain(NO_OPEN_CASES);
    },
  );

  it('says there is no open case when there are no cases', () => {
    expect(renderSummary([]).textContent).toContain(NO_OPEN_CASES);
  });

  it('links to Help and cases and to reporting a problem', () => {
    const links = [...renderSummary([]).querySelectorAll('a')];

    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Help and cases', '/help-and-cases?studentId=a'],
      ['Report a problem with my record', '/report-a-problem?studentId=a'],
    ]);
  });

  it('has no axe violations', async () => {
    const container = renderSummary([row(CaseStatus.Open)]);

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
