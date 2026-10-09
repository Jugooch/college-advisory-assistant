// @vitest-environment jsdom
/**
 * @file Tests for stored block references: re-rendered referral and notice blocks, the
 * unavailable fallback, and academic results that are never shown as current.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TemplateBlockEntrySchema } from '@caa/api-contract';
import { AssistantBlockKind, type AssistantBlockRef } from '@caa/domain';
import {
  buildAssistantBlockRef,
  buildAssistantBlockRefOfEveryKind,
  buildNoticeBlock,
  buildReferralBlock,
  syntheticId,
} from '@caa/test-kit';

import { STORED_REFERRAL_UNAVAILABLE } from '../utils/conversation-wording';
import { studentLinks } from '../utils/student-links';
import { BlockBody } from './block-body';
import { StoredBlockRefs } from './stored-block-refs';

const links = studentLinks(syntheticId('student', 1));
const REFS = buildAssistantBlockRefOfEveryKind();
const refOf = (kind: string): AssistantBlockRef => {
  const found = REFS.find((ref) => ref.kind === kind);
  if (found === undefined) {
    throw new Error(`no ${kind} ref`);
  }
  return found;
};
const REFERRAL_REF = refOf(AssistantBlockKind.Referral);
const NOTICE_REF = refOf(AssistantBlockKind.Notice);
const SCHEDULE_REF = refOf(AssistantBlockKind.ScheduleOptions);
const SUMMARY_REF = refOf(AssistantBlockKind.AcademicSummary);
const entry = (refIndex: number, block: unknown) =>
  TemplateBlockEntrySchema.parse({ refIndex, block });
const REFERRAL = buildReferralBlock();
const NOTICE = buildNoticeBlock({
  code: 'OVERRIDE_PROCESS',
  templateId: 'notice-override-process',
  text: 'Overrides are requested through your advising office.',
});

afterEach(cleanup);

describe('StoredBlockRefs', () => {
  it('re-renders a referral with the same markup, heading level and wording as a live turn', () => {
    const live = render(<BlockBody block={REFERRAL} links={links} />);
    const liveHtml = live.container.innerHTML;
    const liveHeading = within(live.container)
      .getAllByRole('heading')
      .map((h) => h.tagName);
    cleanup();

    const { container } = render(
      <StoredBlockRefs refs={[REFERRAL_REF]} links={links} templateBlocks={[entry(0, REFERRAL)]} />,
    );

    expect(container.innerHTML).toContain(liveHtml);
    expect(
      within(container)
        .getAllByRole('heading')
        .map((h) => h.tagName),
    ).toEqual(liveHeading);
    expect(screen.getByText(/Financial aid questions go to the financial aid office/)).toBeTruthy();
    expect(screen.queryByText(new RegExp(STORED_REFERRAL_UNAVAILABLE.slice(0, 40)))).toBeNull();
  });

  it('puts a re-rendered notice in the position of its ref', () => {
    const refs = [SCHEDULE_REF, NOTICE_REF, SUMMARY_REF];
    render(<StoredBlockRefs refs={refs} links={links} templateBlocks={[entry(1, NOTICE)]} />);

    const items = screen.getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('Schedule search shown at');
    expect(items[1]?.textContent).toContain('Overrides are requested');
    expect(items[2]?.textContent).toContain('Academic summary shown at');
  });

  it('keeps the unavailable notice for a referral with no entry', () => {
    render(<StoredBlockRefs refs={[REFERRAL_REF]} links={links} templateBlocks={[]} />);

    expect(screen.getByText(new RegExp(STORED_REFERRAL_UNAVAILABLE.slice(0, 40)))).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Help and cases' })).toBeTruthy();
  });

  it('keeps the unavailable notice when the turn has no templateBlocks field', () => {
    render(<StoredBlockRefs refs={[NOTICE_REF]} links={links} />);

    expect(screen.getByRole('link', { name: 'Open Help and cases' })).toBeTruthy();
  });

  it('shows a stored academic ref as "shown at" with its link, never as a result', () => {
    const { container } = render(
      <StoredBlockRefs
        refs={[
          buildAssistantBlockRef({
            kind: AssistantBlockKind.ScheduleOptions,
            shownAt: '2026-09-22T10:00:05.000-05:00',
          }),
        ]}
        links={links}
      />,
    );

    expect(screen.getByText(/Schedule search shown at/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Rerun it on the planner' })).toBeTruthy();
    expect(within(container).queryAllByRole('heading')).toEqual([]);
  });

  it('ignores an entry that points at an academic ref', () => {
    render(
      <StoredBlockRefs refs={[SCHEDULE_REF]} links={links} templateBlocks={[entry(0, NOTICE)]} />,
    );

    expect(screen.getByText(/Schedule search shown at/)).toBeTruthy();
    expect(screen.queryByText(/Overrides are requested/)).toBeNull();
  });
});
