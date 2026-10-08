/**
 * @file Service tests for saving a plan draft with injected fakes: the replay is the only source
 * of the stored result, authoring is the student's own, and every race or mismatch writes nothing.
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-01
 */
import { describe, expect, it } from 'vitest';

import { PlanRevisionCause } from '@caa/domain';
import { buildAuditSnapshot } from '@caa/test-kit';

import {
  InvalidRequestError,
  NotFoundError,
  RevisionConflictError,
  StaleSourceError,
} from '../../shared/domain-errors';
import {
  actor,
  body,
  matchingAudit,
  NOW,
  pins,
  replay,
  request,
  selected,
  setupPlanServices as setup,
  studentId,
} from '../../testing/plan-services-harness';

describe('PlanDraftsService.savePlan', () => {
  it('stores the replay, never a client result, as revision 1 saved by the actor', async () => {
    const { save, store, calls } = setup();

    const plan = await save();

    expect(plan.latest.result).toEqual(replay);
    expect(plan.latest.cause).toBe(PlanRevisionCause.Saved);
    expect(plan.latest.createdAt).toBe(NOW.toISOString());
    expect(store.planRevisions?.[0]?.revision.createdBy).toBe(actor.userId);
    expect(store.planRevisions?.[0]?.revision.auditSnapshotId).toBe(matchingAudit.id);
    expect(calls).toEqual([[actor, { studentId, ...request }, expect.anything()]]);
  });

  it('appends the next revision to the term plan', async () => {
    const { save, store } = setup();

    await save();
    const second = await save();

    expect(second.latest.revision).toBe(2);
    expect(store.plans).toHaveLength(1);
  });

  it('refuses a non-author with NOT_FOUND before any replay', async () => {
    const { save, calls, store } = setup({ canSave: false });

    await expect(save()).rejects.toBeInstanceOf(NotFoundError);
    expect(calls).toEqual([]);
    expect(store.planRevisions).toBeUndefined();
  });

  it('writes nothing when the replay is refused', async () => {
    const { save, store } = setup({ replayError: new StaleSourceError() });

    await expect(save()).rejects.toBeInstanceOf(StaleSourceError);
    expect(store.planRevisions).toBeUndefined();
  });

  it('writes nothing when the pinned inputs differ', async () => {
    const { save, store } = setup({
      body: { ...body, expectedPinnedInputs: { ...pins, solverWorkCap: 1 } },
    });

    await expect(save()).rejects.toBeInstanceOf(RevisionConflictError);
    expect(store.planRevisions).toBeUndefined();
  });

  it('refuses a selection that is not a replayed option', async () => {
    const { save, store } = setup({ body: { ...body, selectedSectionIds: selected.slice(1) } });

    await expect(save()).rejects.toBeInstanceOf(InvalidRequestError);
    expect(store.planRevisions).toBeUndefined();
  });

  it.each([
    ['another source version', buildAuditSnapshot({ auditVersion: 'audit_demo_r2' })],
    [
      'another record time',
      buildAuditSnapshot({
        auditSource: pins.auditSource,
        auditVersion: pins.auditVersion,
        studentRecordEffectiveAt: '2026-09-01T07:00:00.000Z',
      }),
    ],
  ])(
    'conflicts, writing nothing, when the latest audit has %s than the replay pinned',
    async (_c, audit) => {
      const { save, store } = setup({ audit });

      await expect(save()).rejects.toBeInstanceOf(RevisionConflictError);
      expect(store.planRevisions).toBeUndefined();
    },
  );

  it('conflicts when a racing save created the term plan first', async () => {
    const { save } = setup({
      plans: (base) => ({
        ...base,
        createWithFirstRevision: () => Promise.resolve({ status: 'PLAN_EXISTS' }),
      }),
    });

    await expect(save()).rejects.toBeInstanceOf(RevisionConflictError);
  });

  it('conflicts when a racing save appended the next revision first', async () => {
    const { save } = setup({
      plans: (base) => ({
        ...base,
        appendRevision: () => Promise.resolve({ status: 'REVISION_CONFLICT' }),
      }),
    });

    await save();

    await expect(save()).rejects.toBeInstanceOf(RevisionConflictError);
  });
});
