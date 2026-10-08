/**
 * @file Tests for the revalidation selection rule: kept only if the identical section set is still
 * an option, otherwise null, never another section.
 * @requirement FR-02
 * @requirement FR-11
 */
import { describe, expect, it } from 'vitest';

import { ScheduleOutcome, SectionIdSchema } from '@caa/domain';
import { buildScheduleOptionsResponse, syntheticId } from '@caa/test-kit';

import { carryOverSelection } from './plan-revalidation.logic';

const response = buildScheduleOptionsResponse();
const optionSections = (response.options[0]?.bundles ?? [])
  .flatMap((bundle) => bundle.sections.map((section) => section.sectionId))
  .map((id) => SectionIdSchema.parse(id))
  .sort();

describe('carryOverSelection', () => {
  it('keeps the selection when the identical section set is still an option', () => {
    expect(carryOverSelection(response, [...optionSections].reverse())).toEqual(optionSections);
  });

  it('drops the selection to null when a section was withdrawn', () => {
    expect(carryOverSelection(response, optionSections.slice(1))).toBeNull();
  });

  it('never substitutes another section for one that is gone', () => {
    const other = SectionIdSchema.parse(syntheticId('section', 99));

    expect(carryOverSelection(response, [other, ...optionSections.slice(1)])).toBeNull();
  });

  it('stays null when there was no selection', () => {
    expect(carryOverSelection(response, null)).toBeNull();
  });

  it('drops the selection when the new outcome has no options', () => {
    const none = buildScheduleOptionsResponse({
      outcome: ScheduleOutcome.SearchTimeout,
      options: [],
      courseIds: response.courseIds,
      searchComplete: false,
    });

    expect(carryOverSelection(none, optionSections)).toBeNull();
  });
});
