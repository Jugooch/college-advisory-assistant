/**
 * @file Tests for one schedule option: bundles, checks, credits, unmet preferences, and ranks.
 */
import { describe, expect, it } from 'vitest';

import {
  asyncSection,
  buildOption,
  bundleOf,
  creditLoadCheck,
  LAB_SECTION,
  LECTURE_LAB_BUNDLE,
  LECTURE_SECTION,
  PHYS_301,
  PHYS_301L,
  sectionId,
  UNKNOWN_CREDIT_LOAD,
  UNKNOWN_LOAD_SCHEDULE,
  UNKNOWN_SCHEDULE,
} from '../testing/schedule-option-fixtures';
import { ScheduleOptionSchema, SectionBundleSchema } from './schedule-option.contract';

const accepts = (payload: unknown): boolean => ScheduleOptionSchema.safeParse(payload).success;
const messages = (payload: unknown): readonly string[] =>
  ScheduleOptionSchema.safeParse(payload).error?.issues.map((issue) => issue.message) ?? [];

const CREDIT_MESSAGE =
  'creditLoad must be UNKNOWN when a bundle credit is null, and its total must equal the bundle credits';

describe('SectionBundleSchema', () => {
  it('accepts a lecture with its linked lab from another course, counting only the lecture', () => {
    expect(SectionBundleSchema.parse(LECTURE_LAB_BUNDLE)).toEqual(LECTURE_LAB_BUNDLE);
  });

  it('accepts an unknown credit count', () => {
    const unknown = bundleOf(PHYS_301, [LECTURE_SECTION], null);

    expect(SectionBundleSchema.safeParse(unknown).success).toBe(true);
  });

  it('rejects a primary section that is not first, a repeated section, and an empty bundle', () => {
    for (const sections of [
      [LAB_SECTION, LECTURE_SECTION],
      [LECTURE_SECTION, LECTURE_SECTION],
      [],
    ]) {
      expect(SectionBundleSchema.safeParse(bundleOf(PHYS_301, sections, 400)).success).toBe(false);
    }
  });
});

describe('ScheduleOptionSchema schedule feasibility', () => {
  it('accepts a validated option', () => {
    expect(ScheduleOptionSchema.parse(buildOption())).toEqual(buildOption());
  });

  it('accepts an UNKNOWN schedule only with a NEEDS_VERIFICATION aggregate', () => {
    const unknown = { scheduleFeasibility: UNKNOWN_SCHEDULE };

    expect(accepts(buildOption({ ...unknown, aggregate: 'NEEDS_VERIFICATION' }))).toBe(true);
    expect(accepts(buildOption(unknown))).toBe(false);
  });

  it('rejects a FAIL schedule, because a candidate that breaks a hard rule is not an option', () => {
    const fail = {
      kind: 'SCHEDULE_FEASIBILITY',
      state: 'FAIL',
      reasonCode: 'CREDIT_LIMIT_EXCEEDED',
    };

    expect(accepts(buildOption({ scheduleFeasibility: fail, aggregate: 'BLOCKED' }))).toBe(false);
  });

  it('rejects a CONDITIONAL schedule, which no schedule check produces', () => {
    const conditional = {
      kind: 'SCHEDULE_FEASIBILITY',
      state: 'CONDITIONAL',
      reasonCode: 'IN_PROGRESS_MIN_GRADE',
    };

    // NOTE: `CheckResultSchema` already rejects a CONDITIONAL schedule check (#212), so the
    // option's own PASS-or-UNKNOWN rule is a second guard that this payload never reaches.
    expect(
      accepts(buildOption({ scheduleFeasibility: conditional, aggregate: 'CONDITIONAL' })),
    ).toBe(false);
  });

  it('rejects a schedule check of another kind', () => {
    expect(
      accepts(buildOption({ scheduleFeasibility: { kind: 'CREDIT_LOAD', state: 'PASS' } })),
    ).toBe(false);
  });
});

describe('ScheduleOptionSchema credit load', () => {
  it('rejects a FAIL credit load, because the credit range is a hard rule too', () => {
    const option = buildOption({
      bundles: [bundleOf(PHYS_301, [LECTURE_SECTION, LAB_SECTION], 2000)],
      creditLoad: creditLoadCheck(2000, 'FAIL'),
      aggregate: 'BLOCKED',
    });

    expect(messages(option)).toEqual(['An option never has a FAIL creditLoad']);
  });

  it('rejects a CONDITIONAL credit load, which no credit-load check should produce', () => {
    const conditionalLoad = {
      ...creditLoadCheck(400),
      state: 'CONDITIONAL',
      reasonCode: 'VARIABLE_CREDIT_UNSELECTED',
    };
    const option = buildOption({ creditLoad: conditionalLoad, aggregate: 'CONDITIONAL' });

    expect(messages(option)).toEqual(['An option never has a CONDITIONAL creditLoad']);
  });

  it('requires an UNKNOWN credit load to make the schedule UNKNOWN (ADR-0010 §3)', () => {
    const unknownLoad = { creditLoad: UNKNOWN_CREDIT_LOAD, aggregate: 'NEEDS_VERIFICATION' };

    expect(
      accepts(buildOption({ ...unknownLoad, scheduleFeasibility: UNKNOWN_LOAD_SCHEDULE })),
    ).toBe(true);
    expect(messages(buildOption(unknownLoad))).toEqual([
      'An UNKNOWN creditLoad requires an UNKNOWN scheduleFeasibility',
    ]);
  });

  it('rejects a PASS load over an unknown bundle credit, and accepts an UNKNOWN one', () => {
    const unknownCredits = [bundleOf(PHYS_301, [LECTURE_SECTION, LAB_SECTION], null)];

    expect(
      messages(buildOption({ bundles: unknownCredits, creditLoad: creditLoadCheck(400) })),
    ).toEqual([CREDIT_MESSAGE]);
    expect(
      accepts(
        buildOption({
          bundles: unknownCredits,
          creditLoad: UNKNOWN_CREDIT_LOAD,
          scheduleFeasibility: UNKNOWN_LOAD_SCHEDULE,
          aggregate: 'NEEDS_VERIFICATION',
        }),
      ),
    ).toBe(true);
  });

  it('rejects a load total that differs from the sum of the bundle credits', () => {
    expect(messages(buildOption({ creditLoad: creditLoadCheck(300) }))).toEqual([CREDIT_MESSAGE]);
  });

  it('accepts a load total equal to the sum over two bundles', () => {
    const bundles = [
      LECTURE_LAB_BUNDLE,
      bundleOf(PHYS_301L, [asyncSection(PHYS_301L, sectionId(12))], 100),
    ];

    expect(accepts(buildOption({ bundles, creditLoad: creditLoadCheck(500) }))).toBe(true);
  });
});

describe('ScheduleOptionSchema bundles and preferences', () => {
  it('accepts an unmet preference only on a section of the option', () => {
    const unmet = {
      constraintIndex: 0,
      priorityRank: 1,
      kind: 'UNAVAILABLE_TIME',
      sectionId: LAB_SECTION.sectionId,
      meetingIndex: 0,
      isDataUnknown: false,
    };

    expect(accepts(buildOption({ unmetPreferences: [unmet] }))).toBe(true);
    expect(
      accepts(buildOption({ unmetPreferences: [{ ...unmet, sectionId: sectionId(99) }] })),
    ).toBe(false);
  });

  it('rejects a bundle and course results that name different courses', () => {
    expect(accepts(buildOption({ courseIds: [PHYS_301L] }))).toBe(false);
  });

  it('rejects two bundles for one course', () => {
    expect(accepts(buildOption({ bundles: [LECTURE_LAB_BUNDLE, LECTURE_LAB_BUNDLE] }))).toBe(false);
  });

  it('rejects one section in two bundles', () => {
    const bundles = [LECTURE_LAB_BUNDLE, bundleOf(PHYS_301L, [LAB_SECTION], 0)];

    expect(messages(buildOption({ bundles }))).toEqual(['A section may appear in only one bundle']);
  });

  it('rejects a rank outside 1 to 3', () => {
    expect(accepts(buildOption({ rank: 0 }))).toBe(false);
    expect(accepts(buildOption({ rank: 4 }))).toBe(false);
  });
});
