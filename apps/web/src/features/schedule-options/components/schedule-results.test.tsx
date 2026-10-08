/**
 * @file Tests for the schedule results: every outcome, the limitation codes, and the banned
 * registration wording.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { ScheduleOptionsResponse } from '@caa/api-contract';
import { ReasonCode, ScheduleOutcome } from '@caa/domain';
import {
  buildCheckResult,
  buildScheduleOptionsResponse,
  buildSection,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { indexCourses } from '@/shared/utils/course-display';
import { describeReason } from '@/shared/utils/reason-code-wording';

import { describeOutcome } from '../utils/option-wording';
import { ScheduleResults } from './schedule-results';

const BANNED = /registered|enrolled|approved/i;
const { math102 } = SYNTHETIC_COURSES;
const MATH_LABEL = 'DEMO-MATH 102';
const MATH_NAME = `${MATH_LABEL} (title not available)`;

const COURSE_DISPLAY = {
  courseId: math102.id,
  code: MATH_LABEL,
  title: null,
  credits: { kind: 'FIXED', creditsHundredths: 300 },
} as const;

/**
 * Builds a valid response for the course, with fields overridden.
 *
 * @param overrides - Response fields to replace.
 * @returns The parsed response.
 */
function response(overrides: Partial<ScheduleOptionsResponse> = {}): ScheduleOptionsResponse {
  return buildScheduleOptionsResponse({
    courseIds: [math102.id],
    courses: [COURSE_DISPLAY],
    ...overrides,
  });
}

/**
 * Renders the results as the page would.
 *
 * @param result - The response.
 * @returns The markup.
 */
function render(result: ScheduleOptionsResponse): string {
  return renderToStaticMarkup(<ScheduleResults result={result} courses={indexCourses([])} />);
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

const CONFLICT = buildCheckResult({
  kind: 'SCHEDULE_FEASIBILITY',
  state: 'FAIL',
  reasonCode: 'MODALITY_NOT_ALLOWED',
  evidence: {
    rulesetVersion: null,
    decisiveLeaves: [],
    scheduleIssues: [
      {
        reasonCode: 'MODALITY_NOT_ALLOWED',
        sectionId: buildSection({}, 1).id,
        modality: 'IN_PERSON',
        constraintIndex: 0,
      },
    ],
  },
});

const MISSING = buildCheckResult({
  kind: 'SCHEDULE_FEASIBILITY',
  state: 'UNKNOWN',
  reasonCode: 'SECTION_DATA_MISSING',
  evidence: {
    rulesetVersion: null,
    decisiveLeaves: [],
    scheduleIssues: [{ reasonCode: 'SECTION_DATA_MISSING', courseId: math102.id }],
  },
});

const NO_PLAN: Partial<ScheduleOptionsResponse> = {
  outcome: 'NO_FEASIBLE_PLAN',
  options: [],
  conflictSet: { items: [CONFLICT], isMinimal: false, omittedCount: 0 },
};

const NEEDS_VERIFICATION: Partial<ScheduleOptionsResponse> = {
  outcome: 'NEEDS_VERIFICATION',
  options: [],
  searchComplete: false,
  unresolved: [MISSING],
};

const OUTCOME_CASES: readonly (readonly [ScheduleOutcome, Partial<ScheduleOptionsResponse>])[] = [
  ['OPTIONS_FOUND', {}],
  ['NO_FEASIBLE_PLAN', NO_PLAN],
  ['SEARCH_TIMEOUT', { outcome: 'SEARCH_TIMEOUT', options: [], searchComplete: false }],
  ['NEEDS_VERIFICATION', NEEDS_VERIFICATION],
];

describe('ScheduleResults outcomes', () => {
  it.each(OUTCOME_CASES)('shows %s with its own heading and next step', (outcome, fields) => {
    const html = render(response(fields));
    const wording = describeOutcome(outcome);
    expect(html).toContain(wording.heading);
    expect(html).toContain(wording.nextStep);
    expect(html).toContain('Not resolved');
  });

  it('gives every outcome different wording', () => {
    const headings = Object.values(ScheduleOutcome).map((o) => describeOutcome(o).heading);
    expect(new Set(headings).size).toBe(headings.length);
  });

  it('says nothing was left unresolved only when the list is empty', () => {
    expect(render(response())).toContain('Nothing was left unresolved');
    const html = render(response(NEEDS_VERIFICATION));
    expect(html).not.toContain('Nothing was left unresolved');
    expect(html).toContain(describeReason(ReasonCode.SectionDataMissing).explanation);
    expect(html).toContain(`${MATH_NAME}: `);
  });

  it('says a timeout is not "no schedule", and a no-plan outcome lists its conflicts', () => {
    const timeout = render(
      response({ outcome: 'SEARCH_TIMEOUT', options: [], searchComplete: false }),
    );
    expect(timeout).toContain('does not mean no schedule exists');
    expect(timeout).not.toContain('Verified conflicts');
    const none = render(response(NO_PLAN));
    expect(none).toContain('Verified conflicts');
    expect(none).toContain(describeReason(ReasonCode.ModalityNotAllowed).explanation);
    expect(none).toContain('preferred');
  });

  it('says others may exist when options come from an unfinished search', () => {
    expect(render(response({ searchComplete: false }))).toContain(
      'These options were checked; others may exist',
    );
  });

  it('says how many verified conflicts were left out', () => {
    const items = Array.from({ length: 20 }, (_, index) =>
      buildCheckResult({
        ...CONFLICT,
        evidence: {
          rulesetVersion: null,
          decisiveLeaves: [],
          scheduleIssues: [
            {
              reasonCode: 'MODALITY_NOT_ALLOWED',
              sectionId: buildSection({}, index + 1).id,
              modality: 'IN_PERSON',
              constraintIndex: 0,
            },
          ],
        },
      }),
    );
    const html = render(
      response({ ...NO_PLAN, conflictSet: { items, isMinimal: false, omittedCount: 3 } }),
    );
    expect(html).toContain('3 more verified conflicts are not shown');
  });
});

describe('ScheduleResults limits and safety wording', () => {
  it('shows each limitation as text with its code, for every outcome', () => {
    for (const [, fields] of OUTCOME_CASES) {
      const html = render(response(fields));
      expect(html).toContain('Seat availability: not checked');
      expect(html).toContain('Registration readiness: not checked');
      expect(html).toContain('Not a registration');
      expect(html).toContain('<code>NOT_REGISTERED</code>');
    }
  });

  it('never uses registered, enrolled, or approved, for any outcome', () => {
    for (const [, fields] of OUTCOME_CASES) {
      expect(words(render(response(fields)))).not.toMatch(BANNED);
    }
  });
});

describe('ScheduleResults save controls', () => {
  /**
   * Renders the results with a save control that names its option.
   *
   * @param result - The response.
   * @returns The markup.
   */
  function renderWithSave(result: ScheduleOptionsResponse): string {
    return renderToStaticMarkup(
      <ScheduleResults
        result={result}
        courses={indexCourses([])}
        renderSaveDraft={(option) => (
          <button type="button">
            {option === null ? 'save-none' : `save-${String(option.rank)}`}
          </button>
        )}
      />,
    );
  }

  it('puts one save control in each option card', () => {
    const html = renderWithSave(response());

    expect(html).toContain('>save-1</button>');
    expect(html).not.toContain('save-none');
  });

  it('offers one save control for a result with no options', () => {
    const html = renderWithSave(response(NEEDS_VERIFICATION));

    expect(html).toContain('>save-none</button>');
    expect(html).toContain('Keep this result');
  });

  it('shows no save control when the page supplies none', () => {
    expect(render(response())).not.toContain('Keep this option');
    expect(render(response(NEEDS_VERIFICATION))).not.toContain('Keep this result');
  });
});
