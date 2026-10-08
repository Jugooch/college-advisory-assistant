/**
 * @file Service tests for saving a plan draft with injected fakes: the replay is the only source
 * of the stored result, authoring is the student's own, and every race or mismatch writes nothing.
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-01
 */
import { describe, expect, it } from 'vitest';

import type { SavePlanRequest, ScheduleOptionsRequest } from '@caa/api-contract';
import type { PlanRepository } from '@caa/db';
import {
  PlanFreshness,
  PlanRevisionCause,
  Role,
  SectionIdSchema,
  StudentIdSchema,
  TermIdSchema,
} from '@caa/domain';
import {
  buildActor,
  buildAuditSnapshot,
  buildScheduleOptionsResponse,
  SYNTHETIC_SCHEDULE_PINNED_INPUTS,
  SYNTHETIC_TENANTS,
  syntheticId,
} from '@caa/test-kit';

import {
  InvalidRequestError,
  NotFoundError,
  RevisionConflictError,
  StaleSourceError,
} from '../../shared/domain-errors';
import {
  createInMemoryPlanRepository,
  type InMemoryPlanStore,
} from '../../testing/in-memory-plan-repositories';
import { createRecordingLogger } from '../../testing/in-memory-repositories';
import { createPlanViewsService } from '../plan-views/plan-views.service';
import { createPlanDraftsService } from './plan-drafts.service';

const NOW = new Date('2026-09-01T12:00:00.000Z');
const pins = SYNTHETIC_SCHEDULE_PINNED_INPUTS;
const replay = buildScheduleOptionsResponse();
const actor = buildActor({ roles: [Role.Student], tenantId: SYNTHETIC_TENANTS.a.id }, 1);
const studentId = StudentIdSchema.parse(syntheticId('student', 1));
const request: ScheduleOptionsRequest = {
  termId: TermIdSchema.parse(replay.term.id),
  courseIds: replay.courseIds,
  creditSelections: [],
  constraints: [],
};
const selected = (replay.options[0]?.bundles ?? [])
  .flatMap((bundle) => bundle.sections.map((section) => SectionIdSchema.parse(section.sectionId)))
  .sort();
const body: SavePlanRequest = {
  request,
  selectedSectionIds: selected,
  expectedPinnedInputs: pins,
};
const matchingAudit = buildAuditSnapshot({
  auditSource: pins.auditSource,
  auditVersion: pins.auditVersion,
  studentRecordEffectiveAt: pins.auditRecordEffectiveAt,
});

/** Options a test varies. */
interface Setup {
  readonly canSave?: boolean;
  readonly audit?: ReturnType<typeof buildAuditSnapshot>;
  readonly plans?: (base: PlanRepository) => PlanRepository;
  readonly replayError?: Error;
  readonly body?: SavePlanRequest;
}

/**
 * Builds the service over fakes.
 *
 * @param options - What to vary.
 * @returns The service, the store, and the replay calls made.
 */
function setup(options: Setup = {}) {
  const store: InMemoryPlanStore = {};
  const base = createInMemoryPlanRepository(store);
  const plans = options.plans?.(base) ?? base;
  const calls: unknown[] = [];
  const views = createPlanViewsService({
    access: { canViewStudent: () => Promise.resolve(true) },
    plans,
    cases: { listForStudent: () => Promise.resolve([]) },
    freshness: {
      assess: () =>
        Promise.resolve({
          state: PlanFreshness.Current,
          reasons: [],
          checkedAt: NOW.toISOString(),
        }),
    },
  });
  const service = createPlanDraftsService({
    access: { canSavePlan: () => Promise.resolve(options.canSave ?? true) },
    scheduleOptions: {
      findOptions: (...args) => {
        calls.push(args);
        return options.replayError === undefined
          ? Promise.resolve(replay)
          : Promise.reject(options.replayError);
      },
    },
    auditSnapshots: {
      findLatest: () => Promise.resolve({ status: 'FOUND', audit: options.audit ?? matchingAudit }),
    },
    plans,
    views,
    now: () => NOW,
  });
  const save = () =>
    service.savePlan(
      actor,
      { studentId, body: options.body ?? body },
      { logger: createRecordingLogger() },
    );
  return { save, store, calls };
}

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
