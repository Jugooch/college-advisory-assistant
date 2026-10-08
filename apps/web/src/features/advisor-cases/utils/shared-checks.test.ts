/**
 * @file Tests for the checks listed in the "what will be shared" preview: only checks that did not
 * pass, read as the API returned them, and never a guess when the result can't be read.
 */
import { describe, expect, it } from 'vitest';

import { AggregateState, CheckKind, CheckState, ReasonCode, ScheduleOutcome } from '@caa/domain';
import {
  buildCheckResult,
  buildPlanRevisionView,
  buildResultUnavailablePlanRevisionView,
  buildScheduleOption,
  buildScheduleOptionsResponse,
} from '@caa/test-kit';

import { describeCheckKind, listSharedChecks } from './shared-checks';

const UNKNOWN_PREREQUISITE = buildCheckResult({
  kind: CheckKind.Prerequisite,
  state: CheckState.Unknown,
  reasonCode: ReasonCode.PrerequisiteRuleMissing,
});

/**
 * Builds a revision whose saved option has an UNKNOWN prerequisite.
 *
 * @returns The revision view.
 */
function revisionWithUnknownPrerequisite() {
  const base = buildScheduleOption();
  const option = buildScheduleOption({
    courseResults: base.courseResults.map((result) => ({
      ...result,
      prerequisite: UNKNOWN_PREREQUISITE,
    })),
    aggregate: AggregateState.NeedsVerification,
  });
  return buildPlanRevisionView({ result: buildScheduleOptionsResponse({ options: [option] }) });
}

describe('listSharedChecks', () => {
  it('lists nothing when every check of the saved option passed', () => {
    expect(listSharedChecks(buildPlanRevisionView())).toEqual({
      kind: 'listed',
      checks: [],
      omittedCount: 0,
    });
  });

  it('lists an UNKNOWN check with its dimension, course, state, and reason, never as passed', () => {
    const shared = listSharedChecks(revisionWithUnknownPrerequisite());

    expect(shared.kind).toBe('listed');
    if (shared.kind !== 'listed') {
      return;
    }
    expect(shared.checks).toHaveLength(1);
    expect(shared.checks[0]).toMatchObject({
      kind: CheckKind.Prerequisite,
      state: CheckState.Unknown,
      reasonCode: ReasonCode.PrerequisiteRuleMissing,
    });
    expect(shared.checks[0]?.courseId).not.toBeNull();
  });

  it('says unavailable, not empty, when the stored result can’t be read', () => {
    expect(listSharedChecks(buildResultUnavailablePlanRevisionView())).toEqual({
      kind: 'unavailable',
    });
  });

  it('lists the unresolved schedule checks when no option was saved', () => {
    const option = buildScheduleOption();
    const unresolved = buildCheckResult({
      kind: CheckKind.ScheduleFeasibility,
      state: CheckState.Unknown,
      reasonCode: ReasonCode.SectionDataMissing,
      evidence: {
        rulesetVersion: null,
        decisiveLeaves: [],
        scheduleIssues: option.bundles.map((bundle) => ({
          reasonCode: ReasonCode.SectionDataMissing,
          courseId: bundle.courseId,
        })),
      },
    });
    const revision = buildPlanRevisionView({
      outcome: ScheduleOutcome.NeedsVerification,
      selectedSectionIds: null,
      result: buildScheduleOptionsResponse({
        outcome: ScheduleOutcome.NeedsVerification,
        searchComplete: false,
        options: [],
        courseIds: option.bundles.map((bundle) => bundle.courseId),
        unresolved: [unresolved],
      }),
    });

    const shared = listSharedChecks(revision);

    expect(shared).toMatchObject({ kind: 'listed' });
    expect(shared.kind === 'listed' ? shared.checks.map((check) => check.kind) : []).toEqual([
      CheckKind.ScheduleFeasibility,
    ]);
  });

  it('lists the conflict set of a search that found no feasible plan, with the omitted count', () => {
    const option = buildScheduleOption();
    const conflict = buildCheckResult({
      kind: CheckKind.CreditLoad,
      state: CheckState.Fail,
      reasonCode: ReasonCode.CreditLimitExceeded,
      evidence: {
        rulesetVersion: null,
        decisiveLeaves: [],
        creditLoad: {
          totalCreditsHundredths: 1800,
          minCreditsHundredths: 1200,
          maxCreditsHundredths: 1500,
        },
      },
    });
    const revision = buildPlanRevisionView({
      outcome: ScheduleOutcome.NoFeasiblePlan,
      selectedSectionIds: null,
      result: buildScheduleOptionsResponse({
        outcome: ScheduleOutcome.NoFeasiblePlan,
        searchComplete: true,
        options: [],
        courseIds: option.bundles.map((bundle) => bundle.courseId),
        unresolved: [],
        conflictSet: { items: [conflict], isMinimal: false, omittedCount: 0 },
      }),
    });

    expect(listSharedChecks(revision)).toEqual({
      kind: 'listed',
      checks: [
        {
          key: '0-CREDIT_LOAD-set',
          kind: CheckKind.CreditLoad,
          courseId: null,
          state: CheckState.Fail,
          reasonCode: ReasonCode.CreditLimitExceeded,
        },
      ],
      omittedCount: 0,
    });
  });

  it('never says an unfinished search has no failures', () => {
    const option = buildScheduleOption();
    const revision = buildPlanRevisionView({
      outcome: ScheduleOutcome.SearchTimeout,
      selectedSectionIds: null,
      result: buildScheduleOptionsResponse({
        outcome: ScheduleOutcome.SearchTimeout,
        searchComplete: false,
        options: [],
        courseIds: option.bundles.map((bundle) => bundle.courseId),
        unresolved: [],
        conflictSet: null,
      }),
    });

    expect(listSharedChecks(revision)).toEqual({ kind: 'incomplete', checks: [] });
  });
});

describe('describeCheckKind', () => {
  it.each(Object.values(CheckKind))('names %s', (kind) => {
    expect(describeCheckKind(kind).length).toBeGreaterThan(3);
  });
});
