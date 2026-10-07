/**
 * @file Tests for the plan-draft endpoints and responses.
 */
import { describe, expect, it } from 'vitest';

import {
  buildPlanView,
  buildRevisionView,
  CURRENT_FRESHNESS,
  PLAN_ID,
} from '../testing/plan-draft-fixtures';
import { TERM_ID } from '../testing/schedule-option-fixtures';
import {
  getPlanEndpoint,
  getPlanRevisionEndpoint,
  listPlansEndpoint,
  PlanListResponseSchema,
  PlanViewSchema,
  revalidatePlanEndpoint,
  savePlanEndpoint,
} from './plan-drafts.contract';

const SECOND_PLAN = '7b000000-0000-4000-8000-000000000002';
const SECOND_TERM = '92a3b4c5-0000-4000-8000-000000000004';

const SUMMARY = {
  id: PLAN_ID,
  termId: TERM_ID,
  latestRevision: 2,
  createdAt: '2026-10-07T09:00:00.000-05:00',
  outcome: 'OPTIONS_FOUND',
  freshness: CURRENT_FRESHNESS,
  openCaseStatus: null,
};

const plan = (fields: Record<string, unknown>): boolean =>
  PlanViewSchema.safeParse(buildPlanView(fields)).success;

const list = (plans: readonly unknown[]): boolean =>
  PlanListResponseSchema.safeParse({ plans }).success;

describe('plan-draft endpoints', () => {
  it('declare student-scoped paths and methods', () => {
    expect(
      [
        savePlanEndpoint,
        listPlansEndpoint,
        getPlanEndpoint,
        getPlanRevisionEndpoint,
        revalidatePlanEndpoint,
      ].map(({ method, path }) => `${method} ${path}`),
    ).toEqual([
      'POST /v1/students/:studentId/plans',
      'GET /v1/students/:studentId/plans',
      'GET /v1/students/:studentId/plans/:planId',
      'GET /v1/students/:studentId/plans/:planId/revisions/:revision',
      'POST /v1/students/:studentId/plans/:planId/revalidate',
    ]);
  });

  it('return the plan view and the revision view', () => {
    expect(savePlanEndpoint.response).toBe(revalidatePlanEndpoint.response);
    expect(getPlanEndpoint.response).toBe(PlanViewSchema);
    expect(getPlanRevisionEndpoint.response.safeParse(buildRevisionView()).success).toBe(true);
  });
});

describe('PlanViewSchema', () => {
  it('accepts a plan with one revision', () => {
    expect(plan({})).toBe(true);
  });

  it('accepts a plan whose latest revision is revalidated', () => {
    expect(
      plan({
        latest: buildRevisionView({
          revision: 2,
          cause: 'REVALIDATED',
          createdAt: '2026-10-08T09:00:00.000-05:00',
        }),
        revisions: [
          { revision: 1, cause: 'SAVED', createdAt: '2026-10-07T09:00:00.000-05:00' },
          { revision: 2, cause: 'REVALIDATED', createdAt: '2026-10-08T09:00:00.000-05:00' },
        ],
      }),
    ).toBe(true);
  });

  it('rejects an empty index and an index that skips or stops short of the latest', () => {
    const entry = (revision: number): Record<string, unknown> => ({
      revision,
      cause: 'SAVED',
      createdAt: '2026-10-07T09:00:00.000-05:00',
    });

    expect(plan({ revisions: [] })).toBe(false);
    expect(plan({ revisions: [entry(2)] })).toBe(false);
    expect(plan({ revisions: [entry(1), entry(2)] })).toBe(false);
  });

  it('rejects a latest revision of another plan or term, or one the index disagrees with', () => {
    expect(plan({ latest: buildRevisionView({ planId: SECOND_PLAN }) })).toBe(false);
    expect(plan({ latest: buildRevisionView({ termId: SECOND_TERM }) })).toBe(false);
    expect(plan({ latest: buildRevisionView({ cause: 'REVALIDATED' }) })).toBe(false);
    expect(
      plan({ latest: buildRevisionView({ createdAt: '2026-10-09T09:00:00.000-05:00' }) }),
    ).toBe(false);
  });

  it('rejects a plan createdAt that differs from the first revision', () => {
    expect(plan({ createdAt: '2026-10-06T09:00:00.000-05:00' })).toBe(false);
  });

  it('rejects an extra field such as an approval status', () => {
    expect(plan({ approved: true })).toBe(false);
  });
});

describe('PlanListResponseSchema', () => {
  it('accepts no plans and one entry per term', () => {
    expect(list([])).toBe(true);
    expect(list([SUMMARY, { ...SUMMARY, id: SECOND_PLAN, termId: SECOND_TERM }])).toBe(true);
  });

  it('accepts an open case status and no status', () => {
    expect(list([{ ...SUMMARY, openCaseStatus: 'OPEN' }])).toBe(true);
    expect(list([{ ...SUMMARY, openCaseStatus: 'IN_REVIEW' }])).toBe(true);
  });

  it('rejects a closed case status and a missing status', () => {
    expect(list([{ ...SUMMARY, openCaseStatus: 'RESOLVED' }])).toBe(false);
    expect(list([{ ...SUMMARY, openCaseStatus: undefined }])).toBe(false);
  });

  it('rejects a repeated plan or term', () => {
    expect(list([SUMMARY, { ...SUMMARY, termId: SECOND_TERM }])).toBe(false);
    expect(list([SUMMARY, { ...SUMMARY, id: SECOND_PLAN }])).toBe(false);
  });

  it('rejects a revision number below 1 and an invalid freshness', () => {
    expect(list([{ ...SUMMARY, latestRevision: 0 }])).toBe(false);
    expect(list([{ ...SUMMARY, freshness: { ...CURRENT_FRESHNESS, state: 'STALE' } }])).toBe(false);
  });
});
