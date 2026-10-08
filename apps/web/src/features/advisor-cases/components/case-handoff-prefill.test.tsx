// @vitest-environment jsdom
/**
 * @file Tests that a handoff from chat preselects the reason or subject and leaves the note empty.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CaseReason, DiscrepancySubject } from '@caa/domain';
import { buildPlanRevisionView, syntheticId } from '@caa/test-kit';

import { AskAdvisorForm } from './ask-advisor-form';
import { ReportProblemForm } from './report-problem-form';

const STUDENT_ID = syntheticId('student', 1);
const CASES_HREF = `/help-and-cases?studentId=${STUDENT_ID}`;
const createAction = vi.fn();
afterEach(cleanup);

describe('case form prefill', () => {
  it('preselects the reason from chat and starts with an empty note', () => {
    render(
      <AskAdvisorForm
        createAction={createAction}
        studentId={STUDENT_ID}
        revision={buildPlanRevisionView()}
        initialReason={CaseReason.NeedsVerification}
        casesHref={CASES_HREF}
      />,
    );
    const checked = screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked);
    expect(checked.map((r) => (r as HTMLInputElement).value)).toEqual([
      CaseReason.NeedsVerification,
    ]);
    expect(screen.getByRole('textbox')).toHaveProperty('value', '');
  });

  it('preselects the subject from chat', () => {
    render(
      <ReportProblemForm
        createAction={createAction}
        studentId={STUDENT_ID}
        initialSubject={DiscrepancySubject.Section}
        casesHref={CASES_HREF}
      />,
    );
    const checked = screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked);
    expect(checked.map((r) => (r as HTMLInputElement).value)).toEqual([DiscrepancySubject.Section]);
  });
});
