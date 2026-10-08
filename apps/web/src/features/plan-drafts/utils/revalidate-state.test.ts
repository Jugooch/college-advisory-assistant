/**
 * @file Tests for the revalidate states: what a new plan and each API error turn into, what
 * became of the earlier choice, and the banned wording.
 */
import { describe, expect, it } from 'vitest';

import { ErrorCode } from '@caa/domain';
import {
  buildPlanRevisionView,
  buildPlanView,
  buildResultUnavailablePlanRevisionView,
} from '@caa/test-kit';

import {
  describeBlockedRevalidation,
  describeRevalidated,
  REVALIDATE_CONFLICT_MESSAGE,
  REVALIDATE_REJECTED_MESSAGE,
  toRevalidatedState,
  toRevalidateFailedState,
  toSelectionOutcome,
} from './revalidate-state';

const BANNED = /registered|enrolled|approved|validated/i;

/**
 * Builds a plan whose latest revision has or lacks a chosen option.
 *
 * @param hasSelection - Whether the latest revision keeps a selection.
 * @returns The plan view.
 */
function planWith(hasSelection: boolean) {
  const latest = hasSelection
    ? buildPlanRevisionView({ revision: 2, cause: 'REVALIDATED' })
    : // The domain ties a null selection to an outcome with no options.
      buildResultUnavailablePlanRevisionView({
        revision: 2,
        cause: 'REVALIDATED',
        outcome: 'NO_FEASIBLE_PLAN',
        selectedSectionIds: null,
      });
  return buildPlanView({ latest });
}

describe('toSelectionOutcome', () => {
  it('reports carried when the server kept the selection', () => {
    expect(toSelectionOutcome(true, planWith(true))).toBe('carried');
  });

  it('reports chosen-again when the server cleared a selection', () => {
    expect(toSelectionOutcome(true, planWith(false))).toBe('chosen-again');
  });

  it('reports none when nothing was chosen before', () => {
    expect(toSelectionOutcome(false, planWith(false))).toBe('none');
  });
});

describe('toRevalidatedState and describeRevalidated', () => {
  it('carries the new revision number as the API numbered it', () => {
    expect(toRevalidatedState(planWith(true), true)).toEqual({
      kind: 'revalidated',
      revision: 2,
      selection: 'carried',
    });
  });

  it('tells the student the earlier choice is gone and to choose an option', () => {
    const text = describeRevalidated({
      kind: 'revalidated',
      revision: 2,
      selection: 'chosen-again',
    });

    expect(text).toContain('Revision 2 was added');
    expect(text).toContain('Your earlier choice is no longer available; choose an option');
  });

  it('says the choice carried over when it did', () => {
    const text = describeRevalidated({ kind: 'revalidated', revision: 3, selection: 'carried' });

    expect(text).toContain('carried over');
    expect(text).not.toContain('no longer available');
  });

  it('says nothing about a choice when there was none', () => {
    const text = describeRevalidated({ kind: 'revalidated', revision: 2, selection: 'none' });

    expect(text).not.toMatch(/choice/);
    expect(text).not.toMatch(BANNED);
  });
});

describe('toRevalidateFailedState', () => {
  const base = { message: 'API says', requestId: 'req-1' };

  it('maps REVISION_CONFLICT to the conflict state', () => {
    expect(toRevalidateFailedState({ ...base, code: ErrorCode.RevisionConflict })).toEqual({
      kind: 'conflict',
    });
  });

  it.each([ErrorCode.StaleSource, ErrorCode.SourceUnavailable])('maps %s to a referral', (code) => {
    expect(toRevalidateFailedState({ ...base, code })).toEqual({ kind: 'blocked', code });
  });

  it('keeps any other error’s own code, message, and request ID', () => {
    expect(toRevalidateFailedState({ ...base, code: ErrorCode.NotFound })).toEqual({
      kind: 'failed',
      code: ErrorCode.NotFound,
      message: 'API says',
      requestId: 'req-1',
    });
  });
});

describe('fixed wording', () => {
  it('says nothing was changed and offers an advisor for both blocked codes', () => {
    for (const code of ['STALE_SOURCE', 'SOURCE_UNAVAILABLE'] as const) {
      const text = describeBlockedRevalidation(code);

      expect(text).toContain('Nothing was changed');
      expect(text).toContain('advisor');
      expect(text).not.toMatch(BANNED);
    }
    expect(describeBlockedRevalidation('STALE_SOURCE')).not.toBe(
      describeBlockedRevalidation('SOURCE_UNAVAILABLE'),
    );
  });

  it('keeps the conflict and rejected messages free of banned wording', () => {
    expect(REVALIDATE_CONFLICT_MESSAGE).toContain('loaded the latest revision');
    expect(`${REVALIDATE_CONFLICT_MESSAGE} ${REVALIDATE_REJECTED_MESSAGE}`).not.toMatch(BANNED);
  });
});
