/**
 * @file Tests for the linked-course results of a schedule option (ADR-0010 Amendment 4).
 */
import { describe, expect, it } from 'vitest';

import {
  asyncSection,
  buildOption,
  bundleOf,
  CHEM_101,
  creditLoadCheck,
  LAB_SECTION,
  LECTURE_SECTION,
  type Payload,
  PHYS_301,
  PHYS_301L,
  sectionId,
} from '../testing/schedule-option-fixtures';
import { ScheduleOptionSchema } from './schedule-option.contract';

const accepts = (payload: unknown): boolean => ScheduleOptionSchema.safeParse(payload).success;

const NOT_CHECKED: Payload = {
  kind: 'PREREQUISITE',
  state: 'UNKNOWN',
  reasonCode: 'LINKED_COURSE_NOT_CHECKED',
};
const NOT_CHECKED_APPLICABILITY: Payload = {
  kind: 'REQUIREMENT_APPLICABILITY',
  state: 'UNKNOWN',
  reasonCode: 'LINKED_COURSE_NOT_CHECKED',
};

/**
 * Builds a linked-course entry whose two checks are UNKNOWN `LINKED_COURSE_NOT_CHECKED`.
 *
 * @param courseId - The linked course.
 * @returns The entry payload.
 */
const entry = (courseId: string): Payload => ({
  courseId,
  prerequisite: NOT_CHECKED,
  applicability: NOT_CHECKED_APPLICABILITY,
});

/** The lecture with a linked lab that counts its own 1.00 credit. */
const COUNTING_LAB = { ...LAB_SECTION, countsCredits: true };
const CREDIT_BEARING_BUNDLE = bundleOf(PHYS_301, [LECTURE_SECTION, COUNTING_LAB], 500);
const credit = { creditLoad: creditLoadCheck(500) };
const flagged = { aggregate: 'NEEDS_VERIFICATION' };

describe('ScheduleOptionSchema linkedCourseResults', () => {
  it('accepts a credit-bearing linked lab with its entry only as NEEDS_VERIFICATION', () => {
    const linked = {
      bundles: [CREDIT_BEARING_BUNDLE],
      linkedCourseResults: [entry(PHYS_301L)],
      ...credit,
    };

    expect(accepts(buildOption({ ...linked, ...flagged }))).toBe(true);
    expect(accepts(buildOption({ ...linked, aggregate: 'VALIDATED' }))).toBe(false);
  });

  it('accepts an included lab (countsCredits false) with no entry', () => {
    expect(accepts(buildOption({ linkedCourseResults: [] }))).toBe(true);
  });

  it('accepts no entries whatever the sections countsCredits, the engine owns that rule', () => {
    expect(accepts(buildOption({ bundles: [CREDIT_BEARING_BUNDLE], ...credit }))).toBe(true);
  });

  it('accepts an entry for an included lab, such as one with a prerequisite of its own', () => {
    const option = buildOption({ linkedCourseResults: [entry(PHYS_301L)], ...flagged });

    expect(accepts(option)).toBe(true);
  });

  it('rejects an entry for a requested course', () => {
    expect(accepts(buildOption({ linkedCourseResults: [entry(PHYS_301)], ...flagged }))).toBe(
      false,
    );
  });

  it('rejects an entry for a course with no shown section', () => {
    expect(accepts(buildOption({ linkedCourseResults: [entry(CHEM_101)], ...flagged }))).toBe(
      false,
    );
  });

  it('rejects a repeated entry', () => {
    const repeated = [entry(PHYS_301L), entry(PHYS_301L)];

    expect(accepts(buildOption({ linkedCourseResults: repeated, ...flagged }))).toBe(false);
  });
});

describe('ScheduleOptionSchema linkedCourseResults order', () => {
  const second = sectionId(12);
  const extra = { ...asyncSection(CHEM_101, second), countsCredits: true };
  const bundle = bundleOf(PHYS_301, [LECTURE_SECTION, COUNTING_LAB, extra], 600);
  const option = (entries: readonly Payload[]): Payload =>
    buildOption({
      bundles: [bundle],
      linkedCourseResults: entries,
      creditLoad: creditLoadCheck(600),
      ...flagged,
    });

  it('accepts entries in ascending course ID order', () => {
    expect(accepts(option([entry(CHEM_101), entry(PHYS_301L)]))).toBe(true);
  });

  it('rejects entries out of order', () => {
    expect(accepts(option([entry(PHYS_301L), entry(CHEM_101)]))).toBe(false);
  });
});

describe('ScheduleOptionSchema linked-course aggregate', () => {
  it('counts a linked check: UNKNOWN entries are never VALIDATED', () => {
    const option = buildOption({ linkedCourseResults: [entry(PHYS_301L)], aggregate: 'VALIDATED' });

    expect(accepts(option)).toBe(false);
  });
});
