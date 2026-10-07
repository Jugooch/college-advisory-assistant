/**
 * @file Tests for the plan revision cause vocabulary.
 */
import { describe, expect, it } from 'vitest';

import { PlanRevisionCause, PlanRevisionCauseSchema } from './plan-revision-cause.enum';

describe('PlanRevisionCause', () => {
  it('lists the fixed causes and rejects others', () => {
    expect(Object.values(PlanRevisionCause)).toEqual(['SAVED', 'REVALIDATED']);
    expect(PlanRevisionCauseSchema.safeParse('EDITED').success).toBe(false);
  });
});
