/**
 * @file Tests the demo's state preparation against a fake API.
 * @requirement FR-11
 * @requirement FR-12
 */
import { describe, expect, it } from 'vitest';

import {
  CreateCaseRequestSchema,
  SavePlanRequestSchema,
  ScheduleOptionsRequestSchema,
} from '@caa/api-contract';
import { buildDemoSeedPlan } from '@caa/db/testing';

import {
  buildDiscrepancyBody,
  buildPlanReviewBody,
  buildSaveBody,
  buildScheduleRequest,
  pickFirstOptionSections,
  pickPlanningTermId,
  prepareDemoState,
} from './demo-state.mjs';

const TERMS = {
  terms: [
    { id: 't1', termCode: '2026FA' },
    { id: 't4', termCode: '2027SP' },
  ],
};
const OPTIONS = {
  outcome: 'OPTIONS_FOUND',
  pinnedInputs: { pinned: true },
  options: [
    {
      bundles: [
        { sections: [{ sectionId: 'b' }] },
        { sections: [{ sectionId: 'a' }, { sectionId: 'b' }] },
      ],
    },
  ],
};

/**
 * A fake client that records calls in order and answers like the API.
 *
 * @param {object} [options] - Fake behavior.
 * @param {string} [options.freshness] - Freshness state the plan-review case reads.
 * @returns {object} The fake dependencies, with the recorded `events`.
 */
function fakeApi({ freshness = 'STALE' } = {}) {
  const events = [];
  const answers = {
    getPlannableTerms: () => TERMS,
    findScheduleOptions: () => OPTIONS,
    savePlan: () => ({ id: 'plan-1', latest: { id: 'rev-1' } }),
    createCase: (_token, options) => ({
      context: { freshness: { state: options.body.reason === 'PLAN_REVIEW' ? freshness : 'X' } },
    }),
    listAdvisorCases: () => ({ cases: [{}, {}] }),
  };
  return {
    events,
    call: async (token, name, options) => {
      events.push({ token, name, options });
      return answers[name](token, options);
    },
    revise: async (id) => {
      events.push({ name: 'revise', id });
    },
    log: () => undefined,
  };
}

describe('pickers and bodies', () => {
  it('picks the planning term by code', () => {
    expect(pickPlanningTermId(TERMS)).toBe('t4');
    expect(() => pickPlanningTermId({ terms: [] })).toThrow(/not plannable/);
  });

  it('lists distinct sorted sections of the first option', () => {
    expect(pickFirstOptionSections(OPTIONS)).toEqual(['a', 'b']);
    expect(() => pickFirstOptionSections({ outcome: 'NO_OPTIONS', options: [] })).toThrow(
      /NO_OPTIONS/,
    );
  });

  it('builds case bodies the contract allows', () => {
    expect(buildPlanReviewBody('r')).toMatchObject({
      reason: 'PLAN_REVIEW',
      planRevisionId: 'r',
      discrepancySubject: null,
    });
    expect(buildDiscrepancyBody()).toMatchObject({
      reason: 'SOURCE_DISCREPANCY',
      planRevisionId: null,
      discrepancySubject: 'COURSE_ATTEMPT',
    });
  });
});

describe('buildScheduleRequest', () => {
  const request = buildScheduleRequest('t4');
  const { courses, policy } = buildDemoSeedPlan(new Date('2026-10-01T12:00:00.000Z')).academic;
  const byId = new Map(courses.map((course) => [course.id, course]));

  it('reaches the seed policy term minimum', () => {
    const selected = new Map(
      request.creditSelections.map((pick) => [pick.courseId, pick.selectedCreditsHundredths]),
    );
    const counted = request.courseIds.map((id) => byId.get(id));
    expect(counted.every((course) => course !== undefined)).toBe(true);
    // NOTE: a course whose credits are included in another's counts once, under the lecture.
    const total = counted
      .filter((course) => course.creditsIncludedInCourseId === null)
      .reduce((sum, course) => sum + (course.creditsHundredths ?? selected.get(course.id)), 0);
    expect(total).toBeGreaterThanOrEqual(policy.termCreditBounds.minCreditsHundredths);
    expect(total).toBeLessThanOrEqual(policy.termCreditBounds.maxCreditsHundredths);
  });
});

describe('prepareDemoState', () => {
  it('saves, revises, then opens both cases, each as its own persona', async () => {
    const api = fakeApi();
    const result = await prepareDemoState(api);

    expect(api.events.map((event) => event.name)).toEqual([
      'getPlannableTerms',
      'findScheduleOptions',
      'savePlan',
      'revise',
      'createCase',
      'createCase',
      'listAdvisorCases',
    ]);
    expect(api.events[3]).toEqual({ name: 'revise', id: 'SYN-000006' });
    expect(api.events[2].token).toBe('dev-token-student-stale');
    expect(api.events[2].options.body).toMatchObject({
      selectedSectionIds: ['a', 'b'],
      expectedPinnedInputs: { pinned: true },
    });
    expect(api.events[4].options.body.planRevisionId).toBe('rev-1');
    expect(api.events[5].token).toBe('dev-token-student-blocked');
    expect(api.events[6].token).toBe('dev-token-advisor');
    expect(result).toEqual({ cases: 2, planId: 'plan-1', staleRevisionId: 'rev-1' });
  });

  it('fails when the case does not read STALE', async () => {
    await expect(prepareDemoState(fakeApi({ freshness: 'CURRENT' }))).rejects.toThrow(/STALE/);
  });
});

describe('request bodies against the contract schemas', () => {
  const TERM_ID = '10000000-0000-4000-8000-000000000004';
  const REVISION_ID = '70000000-0000-4000-8000-000000000001';

  it('builds a schedule-options request the contract accepts', () => {
    expect(ScheduleOptionsRequestSchema.safeParse(buildScheduleRequest(TERM_ID)).success).toBe(
      true,
    );
  });

  it('builds the save body with a request the contract accepts', () => {
    const request = buildScheduleRequest(TERM_ID);
    const body = buildSaveBody(request, { pinnedInputs: {} }, [REVISION_ID]);
    const parsed = SavePlanRequestSchema.safeParse(body);
    const failing = parsed.success ? [] : parsed.error.issues.map((issue) => issue.path[0]);
    // NOTE: only the pinned inputs are a stand-in here; everything the demo builds must parse.
    expect(failing.filter((key) => key !== 'expectedPinnedInputs')).toEqual([]);
  });

  it('builds case bodies the contract accepts', () => {
    expect(CreateCaseRequestSchema.safeParse(buildPlanReviewBody(REVISION_ID)).success).toBe(true);
    expect(CreateCaseRequestSchema.safeParse(buildDiscrepancyBody()).success).toBe(true);
  });
});
