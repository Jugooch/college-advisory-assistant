/**
 * @file Tests for the save-plan and revalidate-plan request bodies.
 */
import { describe, expect, it } from 'vitest';

import { PHYS_301, PINNED_INPUTS, sectionId, TERM_ID } from '../testing/schedule-option-fixtures';
import { RevalidatePlanRequestSchema, SavePlanRequestSchema } from './plan-drafts-request.contract';

const VALID = {
  request: { termId: TERM_ID, courseIds: [PHYS_301], creditSelections: [], constraints: [] },
  selectedSectionIds: [sectionId(1), sectionId(2)],
  expectedPinnedInputs: PINNED_INPUTS,
};

const saves = (fields: Record<string, unknown>): boolean =>
  SavePlanRequestSchema.safeParse({ ...VALID, ...fields }).success;

describe('SavePlanRequestSchema', () => {
  it('accepts a request, a chosen section set, and the pinned inputs', () => {
    expect(SavePlanRequestSchema.parse(VALID)).toEqual(VALID);
  });

  it('accepts a null selection', () => {
    expect(saves({ selectedSectionIds: null })).toBe(true);
  });

  it('accepts 64 sections and rejects 65', () => {
    const ids = (count: number): string[] =>
      Array.from({ length: count }, (_, index) => sectionId(index + 1));

    expect(saves({ selectedSectionIds: ids(64) })).toBe(true);
    expect(saves({ selectedSectionIds: ids(65) })).toBe(false);
  });

  it('rejects an empty selection and a repeated section', () => {
    expect(saves({ selectedSectionIds: [] })).toBe(false);
    expect(saves({ selectedSectionIds: [sectionId(1), sectionId(1)] })).toBe(false);
  });

  it('rejects an omitted selection and omitted pinned inputs', () => {
    expect(saves({ selectedSectionIds: undefined })).toBe(false);
    expect(saves({ expectedPinnedInputs: undefined })).toBe(false);
  });

  it('applies the schedule-options request rules to the nested request', () => {
    const request = (fields: Record<string, unknown>): boolean =>
      saves({ request: { ...VALID.request, ...fields } });
    const eight = Array.from(
      { length: 8 },
      (_, index) => `c0a5e000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    );

    expect(request({ courseIds: eight })).toBe(true);
    expect(request({ courseIds: [...eight, PHYS_301] })).toBe(false);
    expect(request({ courseIds: [] })).toBe(false);
    expect(request({ courseIds: [PHYS_301, PHYS_301] })).toBe(false);
    expect(request({ tenantId: TERM_ID })).toBe(false);
  });

  it('rejects pinned inputs with a bad work cap or hash', () => {
    expect(saves({ expectedPinnedInputs: { ...PINNED_INPUTS, solverWorkCap: 3_000_000 } })).toBe(
      true,
    );
    expect(saves({ expectedPinnedInputs: { ...PINNED_INPUTS, solverWorkCap: 3_000_001 } })).toBe(
      false,
    );
    expect(saves({ expectedPinnedInputs: { ...PINNED_INPUTS, constraintHash: 'abc' } })).toBe(
      false,
    );
  });

  it('rejects a body naming a tenant, user, role, or owner', () => {
    for (const field of ['tenantId', 'userId', 'role', 'ownerUserId', 'studentId']) {
      expect(saves({ [field]: TERM_ID })).toBe(false);
    }
  });
});

describe('RevalidatePlanRequestSchema', () => {
  it('accepts an expected revision', () => {
    expect(RevalidatePlanRequestSchema.parse({ expectedRevision: 3 })).toEqual({
      expectedRevision: 3,
    });
  });

  it('accepts revision 1 and rejects 0, a fraction, and a missing value', () => {
    expect(RevalidatePlanRequestSchema.safeParse({ expectedRevision: 1 }).success).toBe(true);
    expect(RevalidatePlanRequestSchema.safeParse({ expectedRevision: 0 }).success).toBe(false);
    expect(RevalidatePlanRequestSchema.safeParse({ expectedRevision: 1.5 }).success).toBe(false);
    expect(RevalidatePlanRequestSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a body naming a tenant, user, role, or owner', () => {
    for (const field of ['tenantId', 'userId', 'role', 'ownerUserId']) {
      expect(
        RevalidatePlanRequestSchema.safeParse({ expectedRevision: 1, [field]: TERM_ID }).success,
      ).toBe(false);
    }
  });
});
