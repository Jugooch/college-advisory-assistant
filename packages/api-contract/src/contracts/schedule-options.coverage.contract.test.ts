/**
 * @file Tests that every schedule option covers every requested course with exactly one bundle,
 *   and that option prerequisites use the pinned ruleset.
 */
import { describe, expect, it } from 'vitest';

import {
  asyncSection,
  buildOption,
  buildResponse,
  bundleOf,
  CHEM_101,
  PHYS_301,
  prerequisiteCheck,
  sectionId,
  singleSectionBundle,
} from '../testing/schedule-option-fixtures';
import { ScheduleOptionsResponseSchema } from './schedule-options.contract';

const CHEM_BUNDLE = bundleOf(CHEM_101, [asyncSection(CHEM_101, sectionId(2))], 300);
const BOTH_BUNDLES = [singleSectionBundle(1), CHEM_BUNDLE];
const BOTH_COURSES = [PHYS_301, CHEM_101];

const messages = (options: readonly unknown[]): readonly string[] =>
  ScheduleOptionsResponseSchema.safeParse(
    buildResponse({ courseIds: BOTH_COURSES, options }),
  ).error?.issues.map((issue) => issue.message) ?? [];

const COVERAGE_MESSAGE = 'Every option must schedule every requested course, one bundle each';

describe('ScheduleOptionsResponseSchema requested-course coverage', () => {
  it('accepts an option that schedules both requested courses', () => {
    expect(messages([buildOption({ bundles: BOTH_BUNDLES })])).toEqual([]);
  });

  it('rejects an option that drops a requested course, and with it that course’s checks', () => {
    expect(messages([buildOption({ bundles: [singleSectionBundle(1)] })])).toEqual([
      COVERAGE_MESSAGE,
    ]);
  });

  it('rejects an option that drops a course even when its other bundle is unrequested', () => {
    const other = 'c0a5e000-0000-4000-8000-000000000999';
    const swapped = [
      singleSectionBundle(1),
      bundleOf(other, [asyncSection(other, sectionId(3))], 300),
    ];

    expect(messages([buildOption({ bundles: swapped })])).toEqual([COVERAGE_MESSAGE]);
  });
});

describe('ScheduleOptionsResponseSchema ruleset pinning', () => {
  it('accepts option prerequisites evaluated under the pinned ruleset', () => {
    const pinned = buildOption({ bundles: BOTH_BUNDLES, prerequisite: prerequisiteCheck('PASS') });

    expect(messages([pinned])).toEqual([]);
  });

  it('rejects an option prerequisite evaluated under another ruleset', () => {
    const stale = buildOption({
      bundles: BOTH_BUNDLES,
      prerequisite: prerequisiteCheck('PASS', 'demo-2025.9'),
    });

    expect(messages([stale])).toEqual(['Prerequisite evidence must use the pinned rulesetVersion']);
  });
});
