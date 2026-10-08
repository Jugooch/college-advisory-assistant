/**
 * @file Tests for the model status enum.
 */
import { describe, expect, it } from 'vitest';

import { ModelStatus, StoredModelStatusSchema } from './model-status.enum';

describe('ModelStatus', () => {
  it('lists the ADR-0015 values', () => {
    expect(Object.values(ModelStatus)).toEqual([
      'ANSWERED',
      'GUARDED',
      'BUDGET_EXHAUSTED',
      'MODEL_UNAVAILABLE',
      'RATE_LIMITED',
      'DISABLED',
    ]);
  });

  it('stores only the statuses that leave a turn', () => {
    expect(StoredModelStatusSchema.options).toEqual([
      'ANSWERED',
      'GUARDED',
      'BUDGET_EXHAUSTED',
      'MODEL_UNAVAILABLE',
    ]);
  });
});
