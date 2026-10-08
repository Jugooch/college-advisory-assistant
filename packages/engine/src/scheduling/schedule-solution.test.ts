/**
 * @file Tests that the solver's course cap stays tied to the domain plan cap.
 */
import { describe, expect, it } from 'vitest';

import { MAX_PLAN_COURSES } from '@caa/domain';

import { MAX_SOLVER_COURSES } from './schedule-solution';

describe('MAX_SOLVER_COURSES', () => {
  it('equals the domain plan cap, so a plan the schema accepts is never too big to solve', () => {
    expect(MAX_SOLVER_COURSES).toBe(MAX_PLAN_COURSES);
  });
});
