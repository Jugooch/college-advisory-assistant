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
    expect(listSharedChecks(buildPlanRevisionView())).toEqual({ kind: 'listed', checks: [] });
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
});

describe('describeCheckKind', () => {
  it.each(Object.values(CheckKind))('names %s', (kind) => {
    expect(describeCheckKind(kind).length).toBeGreaterThan(3);
  });
});
