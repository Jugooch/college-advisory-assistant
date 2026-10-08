// @vitest-environment jsdom
/**
 * @file Tests for verified cards and the case preview in chat: check states render as the API
 * returned them, and the preview hands off without a note or transcript.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AggregateState, CaseReason, CheckKind, CheckState, ReasonCode } from '@caa/domain';
import {
  buildAcademicSummaryBlock,
  buildCasePreviewBlock,
  buildCheckResult,
  buildPlanEvidenceBlock,
  buildPlanRevisionView,
  buildScheduleOption,
  buildScheduleOptionsBlock,
  buildScheduleOptionsResponse,
  buildStalePlanFreshnessView,
  syntheticId,
} from '@caa/test-kit';

import { AssistantBlocks } from './assistant-blocks';

const STUDENT_ID = syntheticId('student', 1);
afterEach(cleanup);

describe('verified blocks in chat', () => {
  it('renders a CONDITIONAL check as Conditional, never as passed', () => {
    const base = buildScheduleOption();
    const option = buildScheduleOption({
      aggregate: AggregateState.Conditional,
      courseResults: base.courseResults.map((result) => ({
        ...result,
        prerequisite: buildCheckResult({
          kind: CheckKind.Prerequisite,
          state: CheckState.Conditional,
          reasonCode: ReasonCode.InProgressMinGrade,
          sourceRef: 'rule_demo',
          evidence: {
            rulesetVersion: 'demo-2026.1',
            decisiveLeaves: [
              {
                type: 'COURSE',
                path: [],
                courseId: syntheticId('course', 1),
                requiredGrade: { scheme: 'LETTER', value: 'C' },
                attemptIds: [],
                reasonCode: ReasonCode.InProgressMinGrade,
              },
            ],
          },
        }),
      })),
    });
    const block = buildScheduleOptionsBlock({
      result: buildScheduleOptionsResponse({ options: [option] }),
    });
    render(<AssistantBlocks blocks={[block]} studentId={STUDENT_ID} />);
    expect(screen.getAllByText('Conditional').length).toBeGreaterThan(0);
  });

  it('renders saved-plan evidence with its freshness and without calling it registered', () => {
    const plan = buildPlanRevisionView({ freshness: buildStalePlanFreshnessView() });
    const { container } = render(
      <AssistantBlocks blocks={[buildPlanEvidenceBlock({ plan })]} studentId={STUDENT_ID} />,
    );
    const card = within(container);
    expect(card.getByText(/Revision 1, saved/)).toBeTruthy();
    expect(
      card.getByRole('link', { name: /Open this plan in My plans/ }).getAttribute('href'),
    ).toBe(`/my-plans/${plan.planId}?studentId=${STUDENT_ID}`);
    expect(container.textContent).not.toMatch(/\bregistered\b(?! for)/i);
  });

  it('renders the academic summary card from the block', () => {
    render(<AssistantBlocks blocks={[buildAcademicSummaryBlock()]} studentId={STUDENT_ID} />);
    expect(screen.getByRole('region', { name: 'Academic summary' })).toBeTruthy();
  });
});

describe('heading levels in chat', () => {
  it('puts every card under the panel h2: no h2, first heading h3, no skipped level', () => {
    const plan = buildPlanRevisionView({ freshness: buildStalePlanFreshnessView() });
    const { container } = render(
      <AssistantBlocks
        blocks={[
          buildScheduleOptionsBlock(),
          buildPlanEvidenceBlock({ plan }),
          buildAcademicSummaryBlock(),
        ]}
        studentId={STUDENT_ID}
      />,
    );
    const levels = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((h) =>
      Number(h.tagName.slice(1)),
    );
    expect(levels.length).toBeGreaterThan(3);
    expect(levels).not.toContain(2);
    levels.forEach((level, index) => {
      const previous = levels[index - 1] ?? 2;
      expect(level).toBeLessThanOrEqual(previous + 1);
    });
  });

  it('keeps every id unique when two result blocks share the transcript', () => {
    const { container } = render(
      <AssistantBlocks
        blocks={[buildScheduleOptionsBlock(), buildScheduleOptionsBlock()]}
        studentId={STUDENT_ID}
      />,
    );
    const ids = Array.from(container.querySelectorAll('[id]')).map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('case preview in chat', () => {
  it('shows what would be shared, hands off by link, and ignores any suggested note', () => {
    const block = buildCasePreviewBlock({ suggestedNote: 'MODEL NOTE', planRevision: 1 });
    const { container } = render(<AssistantBlocks blocks={[block]} studentId={STUDENT_ID} />);
    expect(screen.getByText(/Nothing has been sent/)).toBeTruthy();
    expect(screen.getByText(/Sent to: Advisors assigned to you/)).toBeTruthy();
    expect(screen.getByText('Your chat is not shared.')).toBeTruthy();
    expect(container.textContent).not.toContain('MODEL NOTE');
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
    const href = screen
      .getByRole('link', { name: /Continue to the request form/ })
      .getAttribute('href');
    expect(href).toContain('/ask-an-advisor?');
    expect(href).toContain(`reason=${CaseReason.PlanReview}`);
    expect(href).not.toMatch(/note|transcript|MODEL/i);
  });
});
