/**
 * @file HTTP-level tests for the open case status in the plan list: OPEN for a new case,
 * IN_REVIEW once claimed, null once resolved or withdrawn, and a case of another tenant ignored.
 * @requirement FR-11
 * @requirement AC14
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { CaseStatus } from '@caa/domain';
import { SYNTHETIC_TENANTS } from '@caa/test-kit';

import { buildCasesWorld, createAsStudent } from '../../testing/cases-harness';
import { getPlans } from '../../testing/plan-drafts-harness';

const { app, store, reset } = buildCasesWorld();

beforeEach(reset);

/**
 * Reads the open case status of the student's only listed plan.
 *
 * @returns The status shown in the list.
 */
async function listedStatus(): Promise<unknown> {
  const response = await getPlans(app, '');
  expect(response.statusCode).toBe(200);
  const body = response.json<{ data: { plans: { openCaseStatus: unknown }[] } }>();
  return body.data.plans[0]?.openCaseStatus;
}

/**
 * Sets the status of every stored case, as a claim, resolve, or withdraw would.
 *
 * @param status - The new status.
 */
function setStatus(status: CaseStatus): void {
  store.cases = (store.cases ?? []).map((entry) => ({ ...entry, status }));
}

describe('plan list: open case status', () => {
  it('is OPEN for a plan with a new case', async () => {
    await createAsStudent(app);

    expect(await listedStatus()).toBe('OPEN');
  });

  it('is IN_REVIEW once the case is claimed', async () => {
    await createAsStudent(app);
    setStatus(CaseStatus.InReview);

    expect(await listedStatus()).toBe('IN_REVIEW');
  });

  it.each([CaseStatus.Resolved, CaseStatus.Withdrawn])('is null once the case is %s', async (s) => {
    await createAsStudent(app);
    setStatus(s);

    expect(await listedStatus()).toBeNull();
  });

  it('is null for a plan with no case', async () => {
    await createAsStudent(app);
    store.cases = [];

    expect(await listedStatus()).toBeNull();
  });

  it("ignores another tenant's case", async () => {
    await createAsStudent(app);
    store.cases = (store.cases ?? []).map((entry) => ({
      ...entry,
      tenantId: SYNTHETIC_TENANTS.b.id,
    }));

    expect(await listedStatus()).toBeNull();
  });
});
