/**
 * @file Tests for the option draft control: the button text and the exact fields for an option
 * and for a result with no options.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ScheduleOptionsRequestSchema } from '@caa/api-contract';
import {
  buildScheduleConstraintSet,
  buildScheduleOption,
  buildScheduleOptionsResponse,
  syntheticId,
} from '@caa/test-kit';

import { optionSectionIds } from '../utils/save-draft-form';
import { bindOptionDraftControl, OptionDraftControl } from './option-draft-control';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const STUDENT_ID = syntheticId('student', 1);
const OPTION = buildScheduleOption();
const RESULT = buildScheduleOptionsResponse({ options: [OPTION] });
const REQUEST = ScheduleOptionsRequestSchema.parse({
  termId: RESULT.term.id,
  courseIds: RESULT.courseIds,
  creditSelections: [],
  constraints: buildScheduleConstraintSet(),
});
const BASE = { saveAction: vi.fn(), studentId: STUDENT_ID, request: REQUEST, result: RESULT };

/**
 * Reads the encoded draft out of the rendered form.
 *
 * @param html - The markup.
 * @returns The decoded draft field.
 */
function draftField(html: string): unknown {
  const match = /name="draft" value="([^"]*)"/.exec(html);
  const encoded = (match?.[1] ?? '').replaceAll('&quot;', '"').replaceAll('&amp;', '&');
  return JSON.parse(encoded);
}

describe('OptionDraftControl', () => {
  it('offers "Save as draft" for an option and sends its sections and the pinned inputs', () => {
    const html = renderToStaticMarkup(<OptionDraftControl {...BASE} option={OPTION} />);

    expect(html).toContain('Save as draft');
    expect(html).toContain(`name="studentId" value="${STUDENT_ID}"`);
    expect(draftField(html)).toEqual({
      request: REQUEST,
      selectedSectionIds: optionSectionIds(OPTION),
      expectedPinnedInputs: RESULT.pinnedInputs,
    });
  });

  it('offers "Save this result" with no selection when there are no options', () => {
    const none = buildScheduleOptionsResponse({
      options: [],
      outcome: 'SEARCH_TIMEOUT',
      searchComplete: false,
      courseIds: RESULT.courseIds,
    });

    const html = renderToStaticMarkup(<OptionDraftControl {...BASE} result={none} option={null} />);

    expect(html).toContain('Save this result');
    expect(draftField(html)).toMatchObject({
      selectedSectionIds: null,
      expectedPinnedInputs: none.pinnedInputs,
    });
  });

  it('binds the shared props so a results view can ask per option', () => {
    const render = bindOptionDraftControl(BASE);

    expect(renderToStaticMarkup(render(OPTION))).toContain('Save as draft');
  });
});
