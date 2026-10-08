/**
 * @file Tests for the save-draft states: what a saved plan and each API error turn into, and the
 * banned registration wording (AC16).
 */
import { describe, expect, it } from 'vitest';

import { ErrorCode } from '@caa/domain';
import {
  buildPlanFreshnessView,
  buildPlanRevisionView,
  buildPlanView,
  buildResultUnavailablePlanRevisionView,
  buildStalePlanFreshnessView,
} from '@caa/test-kit';

import {
  CONFLICT_MESSAGE,
  REJECTED_MESSAGE,
  RESULT_UNAVAILABLE_MESSAGE,
  SAVED_MESSAGE,
  toFailedState,
  toSavedState,
} from './save-draft-state';

describe('toSavedState', () => {
  it('carries the revision number, time, and freshness exactly as the API returned them', () => {
    const latest = buildPlanRevisionView({
      revision: 2,
      cause: 'REVALIDATED',
      freshness: buildStalePlanFreshnessView(),
    });

    const state = toSavedState(buildPlanView({ latest }));

    expect(state).toEqual({
      kind: 'saved',
      revision: 2,
      savedAt: latest.createdAt,
      freshness: latest.freshness,
      isResultUnavailable: false,
    });
  });

  it('flags an unreadable result and never upgrades the freshness', () => {
    const latest = buildResultUnavailablePlanRevisionView({
      freshness: buildPlanFreshnessView({ state: 'UNKNOWN', reasons: ['SOURCE_UNAVAILABLE'] }),
    });

    const state = toSavedState(buildPlanView({ latest }));

    expect(state).toMatchObject({ isResultUnavailable: true });
    expect(state).toMatchObject({ freshness: { state: 'UNKNOWN' } });
  });
});

describe('toFailedState', () => {
  it('maps REVISION_CONFLICT to the conflict state', () => {
    const error = { code: ErrorCode.RevisionConflict, message: 'x', requestId: null };

    expect(toFailedState(error)).toEqual({ kind: 'conflict' });
  });

  it.each([ErrorCode.StaleSource, ErrorCode.SourceUnavailable])(
    'keeps the %s code, message, and reference for the shared wording',
    (code) => {
      expect(toFailedState({ code, message: 'API text', requestId: 'req-1' })).toEqual({
        kind: 'failed',
        code,
        message: 'API text',
        requestId: 'req-1',
      });
    },
  );
});

describe('wording', () => {
  it('says a draft is a plan, not a registration', () => {
    expect(SAVED_MESSAGE).toBe('Draft saved. This is a plan, not a registration.');
    expect(CONFLICT_MESSAGE).toBe('Your options changed since you loaded them. Refresh options.');
  });

  it.each([SAVED_MESSAGE, CONFLICT_MESSAGE, REJECTED_MESSAGE, RESULT_UNAVAILABLE_MESSAGE])(
    'never uses registered, enrolled, or approved: %s',
    (message) => {
      expect(message).not.toMatch(/registered|enrolled|approved/i);
    },
  );
});
