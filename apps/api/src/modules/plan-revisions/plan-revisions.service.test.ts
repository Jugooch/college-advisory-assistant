/**
 * @file Service tests for recording plan revisions with injected fakes: the replay checks, the
 * create-or-append writes, and every race writing nothing.
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-01
 * @requirement NFR-04
 */
import { describe, expect, it } from 'vitest';

import type { PlanRepository } from '@caa/db';
import { PlanFreshness, PlanRevisionCause } from '@caa/domain';
import { buildAuditSnapshot } from '@caa/test-kit';

import {
  InvalidRequestError,
  NotFoundError,
  RevisionConflictError,
} from '../../shared/domain-errors';
import {
  createInMemoryPlanRepository,
  type InMemoryPlanStore,
} from '../../testing/in-memory-plan-repositories';
import { createRecordingLogger } from '../../testing/in-memory-repositories';
import {
  actor,
  matchingAudit,
  NOW,
  pins,
  replay,
  request,
  selected,
  studentId,
} from '../../testing/plan-services-harness';
import { createPlanViewsService } from '../plan-views/plan-views.service';
import { createPlanRevisionsService } from './plan-revisions.service';

const context = { logger: createRecordingLogger() };

/**
 * Builds the service over an in-memory plan store and fakes.
 *
 * @param audit - The latest audit the fake returns.
 * @param wrap - Replaces repository methods to model races.
 * @returns The service and the store.
 */
function setup(
  audit = matchingAudit,
  wrap: (base: PlanRepository) => PlanRepository = (base) => base,
) {
  const store: InMemoryPlanStore = {};
  const plans = wrap(createInMemoryPlanRepository(store));
  const views = createPlanViewsService({
    access: { canViewStudent: () => Promise.resolve(true) },
    plans,
    freshness: {
      assess: () =>
        Promise.resolve({
          state: PlanFreshness.Current,
          reasons: [],
          checkedAt: NOW.toISOString(),
        }),
    },
  });
  const service = createPlanRevisionsService({
    scheduleOptions: { findOptions: () => Promise.resolve(replay) },
    auditSnapshots: { findLatest: () => Promise.resolve({ status: 'FOUND', audit }) },
    plans,
    views,
    now: () => NOW,
  });
  return { service, store };
}

/**
 * Replays with the default request.
 *
 * @param service - The service under test.
 * @param call - Overrides of the replay call.
 * @param call.expectedPins - Pins the client saw, or null.
 * @param call.choose - Selection rule.
 * @returns The replay promise.
 */
function replayWith(
  service: ReturnType<typeof setup>['service'],
  call: Partial<Parameters<ReturnType<typeof setup>['service']['replay']>[0]> = {},
) {
  return service.replay(
    { actor, studentId, request, expectedPins: null, choose: () => selected, ...call },
    context,
  );
}

describe('PlanRevisionsService.replay', () => {
  it('returns the replay with the audit it pinned', async () => {
    const { service } = setup();

    const verified = await replayWith(service);

    expect(verified.result).toEqual(replay);
    expect(verified.auditSnapshotId).toBe(matchingAudit.id);
    expect(verified.selectedSectionIds).toEqual(selected);
  });

  it('conflicts when the client saw other pinned inputs', async () => {
    const { service } = setup();

    await expect(
      replayWith(service, { expectedPins: { ...pins, solverWorkCap: 1 } }),
    ).rejects.toBeInstanceOf(RevisionConflictError);
  });

  it('refuses a selection that is not a replayed option', async () => {
    const { service } = setup();

    await expect(replayWith(service, { choose: () => 'INVALID' })).rejects.toBeInstanceOf(
      InvalidRequestError,
    );
  });

  it('conflicts when the latest audit is not the one the replay pinned', async () => {
    const { service } = setup(buildAuditSnapshot({ auditVersion: 'audit_demo_r2' }));

    await expect(replayWith(service)).rejects.toBeInstanceOf(RevisionConflictError);
  });
});

describe('PlanRevisionsService.record', () => {
  /**
   * Records the default replay.
   *
   * @param service - The service under test.
   * @param target - Where to write.
   * @returns The record promise.
   */
  async function record(
    service: ReturnType<typeof setup>['service'],
    target: Parameters<ReturnType<typeof setup>['service']['record']>[0]['target'],
  ) {
    const verified = await replayWith(service);
    return service.record(
      {
        actor,
        request,
        replay: verified,
        cause: PlanRevisionCause.Saved,
        message: 'plan draft saved',
        target,
      },
      context,
    );
  }

  it('creates the term plan with revision 1', async () => {
    const { service, store } = setup();

    const plan = await record(service, { kind: 'TERM_PLAN', studentId });

    expect(plan.latest.revision).toBe(1);
    expect(store.plans).toHaveLength(1);
  });

  it('appends the next revision to the existing term plan', async () => {
    const { service, store } = setup();
    await record(service, { kind: 'TERM_PLAN', studentId });

    const plan = await record(service, { kind: 'TERM_PLAN', studentId });

    expect(plan.latest.revision).toBe(2);
    expect(store.plans).toHaveLength(1);
  });

  it('appends to a given plan when the latest is the revision seen', async () => {
    const { service, store } = setup();
    const first = await record(service, { kind: 'TERM_PLAN', studentId });
    const [stored] = store.plans ?? [];
    if (stored === undefined) {
      throw new Error('plan missing');
    }

    const second = await record(service, {
      kind: 'NEXT_REVISION',
      plan: stored,
      expectedRevision: 1,
    });

    expect(second.id).toBe(first.id);
    expect(second.latest.revision).toBe(2);
  });

  it('conflicts when the revision seen is no longer the latest', async () => {
    const { service, store } = setup();
    await record(service, { kind: 'TERM_PLAN', studentId });
    const [stored] = store.plans ?? [];
    if (stored === undefined) {
      throw new Error('plan missing');
    }

    await expect(
      record(service, { kind: 'NEXT_REVISION', plan: stored, expectedRevision: 5 }),
    ).rejects.toBeInstanceOf(RevisionConflictError);
    expect(store.planRevisions).toHaveLength(1);
  });

  it('conflicts when a racing save created the term plan first', async () => {
    const { service } = setup(matchingAudit, (base) => ({
      ...base,
      createWithFirstRevision: () => Promise.resolve({ status: 'PLAN_EXISTS' }),
    }));

    await expect(record(service, { kind: 'TERM_PLAN', studentId })).rejects.toBeInstanceOf(
      RevisionConflictError,
    );
  });

  it('conflicts when a racing write appended first', async () => {
    const { service } = setup(matchingAudit, (base) => ({
      ...base,
      appendRevision: () => Promise.resolve({ status: 'REVISION_CONFLICT' }),
    }));
    await record(service, { kind: 'TERM_PLAN', studentId });

    await expect(record(service, { kind: 'TERM_PLAN', studentId })).rejects.toBeInstanceOf(
      RevisionConflictError,
    );
  });

  it('reports NOT_FOUND when the plan vanished', async () => {
    const { service } = setup(matchingAudit, (base) => ({
      ...base,
      appendRevision: () => Promise.resolve({ status: 'PLAN_NOT_FOUND' }),
    }));
    await record(service, { kind: 'TERM_PLAN', studentId });

    await expect(record(service, { kind: 'TERM_PLAN', studentId })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
