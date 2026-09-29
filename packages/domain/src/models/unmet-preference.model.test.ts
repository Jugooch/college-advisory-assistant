/**
 * @file Tests for the unmet preference evidence object.
 */
import { describe, expect, it } from 'vitest';

import { createUnmetPreference, type UnmetPreferenceInput } from './unmet-preference.model';

const LAB_SECTION_ID = '5ec71010-0000-4000-8000-000000000011';

const EARLY_MEETING: UnmetPreferenceInput = {
  constraintIndex: 1,
  priorityRank: 1,
  kind: 'UNAVAILABLE_TIME',
  sectionId: LAB_SECTION_ID,
  meetingIndex: 0,
  isDataUnknown: false,
};

describe('createUnmetPreference', () => {
  it('accepts a missed time preference that names the section and meeting', () => {
    expect(createUnmetPreference(EARLY_MEETING)).toEqual({
      constraintIndex: 1,
      priorityRank: 1,
      kind: 'UNAVAILABLE_TIME',
      sectionId: LAB_SECTION_ID,
      meetingIndex: 0,
      isDataUnknown: false,
    });
  });

  it('accepts a preference counted as missed because the meeting time is to be announced', () => {
    expect(createUnmetPreference({ ...EARLY_MEETING, isDataUnknown: true }).isDataUnknown).toBe(
      true,
    );
  });

  it('accepts a missed credit range on the whole option', () => {
    const range = createUnmetPreference({
      ...EARLY_MEETING,
      kind: 'CREDIT_RANGE',
      sectionId: null,
      meetingIndex: null,
    });

    expect(range).toMatchObject({ sectionId: null, meetingIndex: null });
  });

  it('accepts a missed modality on a section, and a missed campus on a meeting', () => {
    expect(
      createUnmetPreference({ ...EARLY_MEETING, kind: 'ALLOWED_MODALITIES', meetingIndex: null }),
    ).toMatchObject({ kind: 'ALLOWED_MODALITIES', meetingIndex: null });
    expect(createUnmetPreference({ ...EARLY_MEETING, kind: 'ALLOWED_CAMPUSES' })).toMatchObject({
      kind: 'ALLOWED_CAMPUSES',
      meetingIndex: 0,
    });
  });

  it.each([
    { kind: 'UNAVAILABLE_TIME', sectionId: LAB_SECTION_ID, meetingIndex: null },
    { kind: 'UNAVAILABLE_TIME', sectionId: null, meetingIndex: null },
    { kind: 'CREDIT_RANGE', sectionId: LAB_SECTION_ID, meetingIndex: null },
    { kind: 'ALLOWED_MODALITIES', sectionId: LAB_SECTION_ID, meetingIndex: 0 },
    { kind: 'ALLOWED_CAMPUSES', sectionId: null, meetingIndex: 0 },
  ] as const)('rejects a location that does not fit the kind %j', (location) => {
    expect(() => createUnmetPreference({ ...EARLY_MEETING, ...location })).toThrow(
      /must match what the constraint kind restricts/,
    );
  });

  it('rejects a rank below 1 and a negative index', () => {
    expect(() => createUnmetPreference({ ...EARLY_MEETING, priorityRank: 0 })).toThrow();
    expect(() => createUnmetPreference({ ...EARLY_MEETING, constraintIndex: -1 })).toThrow();
    expect(() => createUnmetPreference({ ...EARLY_MEETING, meetingIndex: -1 })).toThrow();
  });
});
