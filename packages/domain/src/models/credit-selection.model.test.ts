/**
 * @file Tests for the credit selection data object.
 */
import { describe, expect, it } from 'vitest';

import { createCreditSelection, CreditSelectionSchema } from './credit-selection.model';

const SELECTION = {
  courseId: 'c0000000-0000-4000-8000-000000000001',
  selectedCreditsHundredths: 350,
};

describe('CreditSelectionSchema', () => {
  it('accepts a whole number of hundredths, including 0', () => {
    expect(createCreditSelection(SELECTION)).toEqual(SELECTION);
    expect(
      CreditSelectionSchema.safeParse({ ...SELECTION, selectedCreditsHundredths: 0 }).success,
    ).toBe(true);
  });

  it('rejects a fraction, a negative value, and unknown keys', () => {
    expect(
      CreditSelectionSchema.safeParse({ ...SELECTION, selectedCreditsHundredths: 3.5 }).success,
    ).toBe(false);
    expect(
      CreditSelectionSchema.safeParse({ ...SELECTION, selectedCreditsHundredths: -1 }).success,
    ).toBe(false);
    expect(CreditSelectionSchema.safeParse({ ...SELECTION, extra: 1 }).success).toBe(false);
  });
});
