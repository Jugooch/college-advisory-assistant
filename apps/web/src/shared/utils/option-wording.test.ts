/**
 * @file Tests for the outcome, limitation, and unmet-preference wording.
 */
import { describe, expect, it } from 'vitest';

import { ScheduleConstraintKind, ScheduleLimitation, ScheduleOutcome } from '@caa/domain';

import { describeLimitation, describeOutcome, describeUnmetPreference } from './option-wording';

describe('option wording', () => {
  it('has wording for every outcome and limitation, none using registration claims', () => {
    const all = [
      ...Object.values(ScheduleOutcome).map(describeOutcome),
      ...Object.values(ScheduleLimitation).map(describeLimitation),
    ];
    expect(all).toHaveLength(7);
    expect(JSON.stringify(all)).not.toMatch(/registered|enrolled|approved/i);
  });

  it('never describes a timeout as having no schedule', () => {
    expect(describeOutcome('SEARCH_TIMEOUT').message).toContain('does not mean no schedule exists');
  });

  it('words every constraint kind, and marks unknown data as unknown', () => {
    for (const kind of Object.values(ScheduleConstraintKind)) {
      const unmet = {
        constraintIndex: 0,
        priorityRank: 2,
        kind,
        sectionId: null,
        meetingIndex: null,
      };
      expect(describeUnmetPreference({ ...unmet, isDataUnknown: false })).toContain('ranked 2');
      expect(describeUnmetPreference({ ...unmet, isDataUnknown: true })).toContain(
        'still to be announced',
      );
    }
  });
});
