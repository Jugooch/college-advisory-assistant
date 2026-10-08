/**
 * @file Service tests for revalidating a plan draft with injected fakes: the stored inputs are
 * replayed, a stale expectedRevision or a refused replay writes nothing, and revision 1 stays as
 * saved.
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-01
 * @requirement NFR-04
 */
import { describe, expect, it } from 'vitest';

import { PlanIdSchema, PlanRevisionCause, ScheduleOutcome, StudentIdSchema } from '@caa/domain';
import { buildAuditSnapshot, buildScheduleOptionsResponse, syntheticId } from '@caa/test-kit';

import {
  NotFoundError,
  RevisionConflictError,
  SourceUnavailableError,
  StaleSourceError,
} from '../../shared/domain-errors';
import { createRecordingLogger } from '../../testing/in-memory-repositories';
import {
  actor,
  matchingAudit,
  replay,
  request,
  selected,
  setupPlanServices as setup,
  studentId,
} from '../../testing/plan-services-harness';

describe('PlanRevalidationService.revalidatePlan', () => {
  it('replays the stored inputs, not any client input, and appends a REVALIDATED revision', async () => {
    const { save, revalidate, store, calls } = setup();
    const first = await save();
    calls.length = 0;

    const second = await revalidate(first.id);

    expect(calls).toEqual([[actor, { studentId, ...request }, expect.anything()]]);
    expect(second.latest.revision).toBe(2);
    expect(second.latest.cause).toBe(PlanRevisionCause.Revalidated);
    expect(second.latest.selectedSectionIds).toEqual(selected);
    expect(store.planRevisions?.[1]?.revision.createdBy).toBe(actor.userId);
    expect(store.planRevisions?.[1]?.revision.auditSnapshotId).toBe(matchingAudit.id);
  });

  it('leaves revision 1 unchanged', async () => {
    const { save, revalidate, store } = setup();
    const first = await save();
    const stored = structuredClone(store.planRevisions?.[0]);

    await revalidate(first.id);

    expect(store.planRevisions?.[0]).toEqual(stored);
  });

  it('stores a null selection when the new options no longer include the chosen sections', async () => {
    const { save, revalidate, options } = setup();
    const first = await save();
    options.replayResult = buildScheduleOptionsResponse({
      outcome: ScheduleOutcome.SearchTimeout,
      options: [],
      courseIds: replay.courseIds,
      searchComplete: false,
    });

    const second = await revalidate(first.id);

    expect(second.latest.selectedSectionIds).toBeNull();
    expect(second.latest.outcome).toBe(ScheduleOutcome.SearchTimeout);
  });

  it('refuses an actor who may not author with NOT_FOUND before any lookup or replay', async () => {
    const { save, revalidate, options, calls, store } = setup();
    const first = await save();
    options.canSave = false;
    calls.length = 0;

    await expect(revalidate(first.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(calls).toEqual([]);
    expect(store.planRevisions).toHaveLength(1);
  });

  it('refuses a plan that does not exist', async () => {
    const { revalidate } = setup();

    await expect(revalidate(PlanIdSchema.parse(syntheticId('plan', 9)))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("refuses another student's plan with NOT_FOUND", async () => {
    const { save, revalidation, store } = setup();
    const first = await save();
    const other = StudentIdSchema.parse(syntheticId('student', 2));

    await expect(
      revalidation.revalidatePlan(
        actor,
        { studentId: other, planId: first.id, body: { expectedRevision: 1 } },
        { logger: createRecordingLogger() },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(store.planRevisions).toHaveLength(1);
  });

  it('conflicts when expectedRevision is not the latest, before any replay', async () => {
    const { save, revalidate, calls, store } = setup();
    const first = await save();
    calls.length = 0;

    await expect(revalidate(first.id, 2)).rejects.toBeInstanceOf(RevisionConflictError);
    expect(calls).toEqual([]);
    expect(store.planRevisions).toHaveLength(1);
  });

  it('conflicts when a racing revalidation appended first', async () => {
    const { save, revalidate } = setup({
      plans: (base) => ({
        ...base,
        appendRevision: () => Promise.resolve({ status: 'REVISION_CONFLICT' }),
      }),
    });
    const first = await save();

    await expect(revalidate(first.id)).rejects.toBeInstanceOf(RevisionConflictError);
  });

  it.each([
    ['stale', new StaleSourceError()],
    ['missing', new SourceUnavailableError()],
  ])('writes nothing when a current source is %s', async (_case, error) => {
    const { save, revalidate, options, store } = setup();
    const first = await save();
    options.replayError = error;

    await expect(revalidate(first.id)).rejects.toBe(error);
    expect(store.planRevisions).toHaveLength(1);
  });

  it('conflicts, writing nothing, when the latest audit moved from the replay pins', async () => {
    const { save, revalidate, options, store } = setup();
    const first = await save();
    options.audit = buildAuditSnapshot({ auditVersion: 'audit_demo_r2' });

    await expect(revalidate(first.id)).rejects.toBeInstanceOf(RevisionConflictError);
    expect(store.planRevisions).toHaveLength(1);
  });
});
