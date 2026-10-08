/**
 * @file Tests for turning chip edits back into valid constraints.
 */
import { describe, expect, it } from 'vitest';

import { ConstraintStrength } from '@caa/domain';
import { buildCreditRange, buildUnavailableTime } from '@caa/test-kit';

import { applyDraft, draftFromConstraint, withStrength } from './chip-draft';

describe('chip draft', () => {
  it('round-trips an unedited constraint', () => {
    const constraint = buildUnavailableTime({ startTime: '09:00', endTime: '11:00' });
    expect(applyDraft(constraint, draftFromConstraint(constraint))).toEqual({
      kind: 'valid',
      constraint,
    });
  });

  it('refuses a credit range with a minimum above the maximum', () => {
    const constraint = buildCreditRange();
    const draft = { ...draftFromConstraint(constraint), min: '18', max: '12' };
    expect(applyDraft(constraint, draft).kind).toBe('invalid');
  });

  it('refuses a time block that ends before it starts and a blank priority', () => {
    const constraint = buildUnavailableTime();
    const backwards = { ...draftFromConstraint(constraint), start: '12:00', end: '09:00' };
    expect(applyDraft(constraint, backwards).kind).toBe('invalid');
    const noRank = { ...draftFromConstraint(constraint), rank: '' };
    expect(applyDraft(constraint, noRank).kind).toBe('invalid');
  });

  it('switches strength and keeps the priority for a preference', () => {
    const hard = withStrength(buildCreditRange(), ConstraintStrength.Hard, 3);
    expect(hard.priorityRank).toBeNull();
    const back = withStrength(hard, ConstraintStrength.Preferred, 3);
    expect(back.priorityRank).toBe(3);
  });
});
