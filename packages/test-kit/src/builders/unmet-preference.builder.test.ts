/**
 * @file Tests for the synthetic unmet preference builder.
 */
import { describe, expect, it } from 'vitest';

import { UnmetPreferenceSchema } from '@caa/domain';

import { buildUnmetPreference } from './unmet-preference.builder';

describe('buildUnmetPreference', () => {
  it('defaults to the rank-1 unavailable-time preference missed by meeting 0 of section seed 1', () => {
    expect(buildUnmetPreference()).toEqual({
      constraintIndex: 0,
      priorityRank: 1,
      kind: 'UNAVAILABLE_TIME',
      sectionId: 'c0000000-0000-4000-8000-000000000001',
      meetingIndex: 0,
      isDataUnknown: false,
    });
  });

  it('marks a miss that comes only from a TBA value', () => {
    expect(buildUnmetPreference({ isDataUnknown: true }).isDataUnknown).toBe(true);
  });

  it('builds a credit-range miss for the whole option, with no section or meeting', () => {
    expect(
      buildUnmetPreference({ kind: 'CREDIT_RANGE', sectionId: null, meetingIndex: null }),
    ).toMatchObject({ kind: 'CREDIT_RANGE', sectionId: null, meetingIndex: null });
  });

  it('returns deep-equal preferences for the same arguments', () => {
    expect(buildUnmetPreference({ constraintIndex: 2 })).toEqual(
      buildUnmetPreference({ constraintIndex: 2 }),
    );
  });

  it('returns a preference that passes the domain schema', () => {
    expect(UnmetPreferenceSchema.safeParse(buildUnmetPreference()).success).toBe(true);
  });

  it('rejects a credit-range miss that names a meeting', () => {
    expect(() => buildUnmetPreference({ kind: 'CREDIT_RANGE' })).toThrow();
  });

  it('rejects a modality miss that names a meeting', () => {
    expect(() => buildUnmetPreference({ kind: 'ALLOWED_MODALITIES' })).toThrow();
  });
});
