/**
 * @file Tests for listing an option's section IDs.
 */
import { describe, expect, it } from 'vitest';

import { buildScheduleOption } from '@caa/test-kit';

import { optionSectionIds } from './option-section-ids';

const OPTION = buildScheduleOption();

describe('optionSectionIds', () => {
  it('lists the option’s sections, distinct and sorted, adding or dropping none', () => {
    const expected = [
      ...new Set(
        OPTION.bundles.flatMap((bundle) => bundle.sections.map((section) => section.sectionId)),
      ),
    ].sort((a, b) => a.localeCompare(b, 'en'));

    expect(optionSectionIds(OPTION)).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
  });
});
