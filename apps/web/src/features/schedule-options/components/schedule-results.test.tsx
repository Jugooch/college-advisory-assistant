/**
 * @file Tests for the schedule results: every outcome, the limitation codes, and the banned
 * registration wording.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { ScheduleOptionsResponse } from '@caa/api-contract';
import { ReasonCode, ScheduleOutcome } from '@caa/domain';

import { describeReason } from '@/shared/utils/reason-code-wording';

import { describeOutcome } from '../utils/option-wording';
import {
  BANNED,
  buildResult,
  CONFLICT,
  COURSES,
  UNRESOLVED,
} from '../utils/schedule-result-fixtures';
import { ScheduleResults } from './schedule-results';

function render(result: ScheduleOptionsResponse): string {
  return renderToStaticMarkup(<ScheduleResults result={result} courses={COURSES} />);
}

/**
 * Visible words only: the contract's limitation codes are shown verbatim in `<code>`.
 *
 * @param html - The rendered markup.
 * @returns The markup without code elements.
 */
function words(html: string): string {
  return html.replace(/<code>.*?<\/code>/g, '');
}

const NO_PLAN: Partial<ScheduleOptionsResponse> = {
  options: [],
  conflictSet: { items: [CONFLICT], isMinimal: false, omittedCount: 0 },
};

const OUTCOME_CASES: readonly (readonly [ScheduleOutcome, Partial<ScheduleOptionsResponse>])[] = [
  ['OPTIONS_FOUND', {}],
  ['NO_FEASIBLE_PLAN', NO_PLAN],
  ['SEARCH_TIMEOUT', { options: [], searchComplete: false }],
  ['NEEDS_VERIFICATION', { options: [], searchComplete: false, unresolved: [UNRESOLVED] }],
];

describe('ScheduleResults outcomes', () => {
  it.each(OUTCOME_CASES)('shows %s with its own heading and next step', (outcome, fields) => {
    const html = render(buildResult({ outcome, ...fields }));
    const wording = describeOutcome(outcome);
    expect(html).toContain(wording.heading);
    expect(html).toContain(wording.nextStep);
  });

  it('gives every outcome different wording', () => {
    const headings = Object.values(ScheduleOutcome).map((o) => describeOutcome(o).heading);
    expect(new Set(headings).size).toBe(headings.length);
  });

  it.each(OUTCOME_CASES)('shows the not-resolved section for %s', (outcome, fields) => {
    const html = render(buildResult({ outcome, ...fields }));
    expect(html).toContain('Not resolved');
  });

  it('says nothing was left unresolved only when the list is empty', () => {
    expect(render(buildResult())).toContain('Nothing was left unresolved');
    const html = render(buildResult({ unresolved: [UNRESOLVED] }));
    expect(html).not.toContain('Nothing was left unresolved');
    expect(html).toContain(describeReason(ReasonCode.SectionDataMissing).explanation);
    expect(html).toContain('PHYS 301 (Mechanics): ');
  });

  it('says a timeout is not "no schedule", and a no-plan outcome lists its conflicts', () => {
    const timeout = render(
      buildResult({ outcome: 'SEARCH_TIMEOUT', options: [], searchComplete: false }),
    );
    expect(timeout).toContain('does not mean no schedule exists');
    expect(timeout).not.toContain('Verified conflicts');
    const none = render(buildResult({ outcome: 'NO_FEASIBLE_PLAN', ...NO_PLAN }));
    expect(none).toContain('Verified conflicts');
    expect(none).toContain(describeReason(ReasonCode.MeetingConflict).explanation);
    expect(none).toContain('preferred');
  });

  it('says others may exist when options come from an unfinished search', () => {
    const html = render(buildResult({ searchComplete: false }));
    expect(html).toContain('These options were checked; others may exist');
  });

  it('says how many verified conflicts were left out', () => {
    const items = [CONFLICT];
    const html = render(
      buildResult({
        outcome: 'NO_FEASIBLE_PLAN',
        options: [],
        conflictSet: { items, isMinimal: false, omittedCount: 3 },
      }),
    );
    expect(html).toContain('3 more verified conflicts are not shown');
  });
});

describe('ScheduleResults limits and safety wording', () => {
  it('shows each limitation as text with its code, for every outcome', () => {
    for (const [outcome, fields] of OUTCOME_CASES) {
      const html = render(buildResult({ outcome, ...fields }));
      expect(html).toContain('Seat availability: not checked');
      expect(html).toContain('Registration readiness: not checked');
      expect(html).toContain('Not a registration');
      expect(html).toContain('<code>NOT_REGISTERED</code>');
    }
  });

  it('never uses registered, enrolled, or approved, for any outcome or reason code', () => {
    for (const [outcome, fields] of OUTCOME_CASES) {
      expect(words(render(buildResult({ outcome, ...fields })))).not.toMatch(BANNED);
    }
    for (const wording of Object.values(ScheduleOutcome).map(describeOutcome)) {
      expect(JSON.stringify(wording)).not.toMatch(BANNED);
    }
  });
});
