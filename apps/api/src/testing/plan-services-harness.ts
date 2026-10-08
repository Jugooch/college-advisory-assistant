/**
 * @file Test harness for the plan services: one plan store, a fake replay, and the save and
 * revalidate services wired over them. Test code only.
 * @module @caa/api/testing/plan-services-harness
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-04
 */
import type {
  PlanView,
  SavePlanRequest,
  ScheduleOptionsRequest,
  ScheduleOptionsResponse,
} from '@caa/api-contract';
import type { PlanRepository } from '@caa/db';
import {
  PlanFreshness,
  type PlanId,
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

import { createPlanDraftsService } from '../modules/plan-drafts/plan-drafts.service';
import {
  createPlanRevalidationService,
  type PlanRevalidationService,
} from '../modules/plan-revalidation/plan-revalidation.service';
import { createPlanRevisionsService } from '../modules/plan-revisions/plan-revisions.service';
import { createPlanViewsService } from '../modules/plan-views/plan-views.service';
import {
  createInMemoryPlanRepository,
  type InMemoryPlanStore,
} from './in-memory-plan-repositories';
import { createRecordingLogger } from './in-memory-repositories';

/** Fixed clock for the plan services. */
export const NOW = new Date('2026-09-01T12:00:00.000Z');
/** The pinned inputs the fake replay reports. */
export const pins = SYNTHETIC_SCHEDULE_PINNED_INPUTS;
/** The schedule options result the fake replay returns by default. */
export const replay = buildScheduleOptionsResponse();
/** The signed-in student, in tenant A. */
export const actor = buildActor({ roles: [Role.Student], tenantId: SYNTHETIC_TENANTS.a.id }, 1);
/** The actor's own student. */
export const studentId = StudentIdSchema.parse(syntheticId('student', 1));
/** The schedule request the stored revisions are replayed from. */
export const request: ScheduleOptionsRequest = {
  termId: TermIdSchema.parse(replay.term.id),
  courseIds: replay.courseIds,
  creditSelections: [],
  constraints: [],
};
/** The sorted section IDs of the replay's first option. */
export const selected = (replay.options[0]?.bundles ?? [])
  .flatMap((bundle) => bundle.sections.map((section) => SectionIdSchema.parse(section.sectionId)))
  .sort();
/** A valid save body choosing the first option on the replay pins. */
export const body: SavePlanRequest = {
  request,
  selectedSectionIds: selected,
  expectedPinnedInputs: pins,
};
/** The latest audit, agreeing with the replay pins. */
export const matchingAudit = buildAuditSnapshot({
  auditSource: pins.auditSource,
  auditVersion: pins.auditVersion,
  studentRecordEffectiveAt: pins.auditRecordEffectiveAt,
});

/** Options a test varies. */
export interface Setup {
  readonly canSave?: boolean;
  readonly audit?: ReturnType<typeof buildAuditSnapshot>;
  readonly plans?: (base: PlanRepository) => PlanRepository;
  readonly replayError?: Error;
  readonly body?: SavePlanRequest;
  /** What the replay returns; the default replay when omitted. */
  readonly replayResult?: ScheduleOptionsResponse;
}

/** What {@link setupPlanServices} returns. */
export interface PlanServices {
  readonly save: () => Promise<PlanView>;
  readonly revalidate: (planId: PlanId, expectedRevision?: number) => Promise<PlanView>;
  readonly revalidation: PlanRevalidationService;
  readonly store: InMemoryPlanStore;
  /** The arguments of each replay made. */
  readonly calls: unknown[];
  /** Controls a test may change after a first save. */
  readonly options: { -readonly [K in keyof Setup]: Setup[K] };
}

/**
 * Builds the save and revalidation services over fakes sharing one plan store. The returned
 * `options` can be changed after a first save, to model sources moving on.
 *
 * @param initial - What to vary.
 * @returns The save and revalidate calls, the revalidation service, the store, and the replay calls made.
 */
export function setupPlanServices(initial: Setup = {}): PlanServices {
  // NOTE: tests change the controls after a first save, to model sources moving on.
  const options: { -readonly [K in keyof Setup]: Setup[K] } = { ...initial };
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
  const revisions = createPlanRevisionsService({
    scheduleOptions: {
      findOptions: (...args) => {
        calls.push(args);
        return options.replayError === undefined
          ? Promise.resolve(options.replayResult ?? replay)
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
  const access = { canSavePlan: () => Promise.resolve(options.canSave ?? true) };
  const service = createPlanDraftsService({ access, revisions });
  const revalidation = createPlanRevalidationService({ access, plans, revisions });
  const save = () =>
    service.savePlan(
      actor,
      { studentId, body: options.body ?? body },
      { logger: createRecordingLogger() },
    );
  const revalidate = (planId: PlanId, expectedRevision = 1) =>
    revalidation.revalidatePlan(
      actor,
      { studentId, planId, body: { expectedRevision } },
      { logger: createRecordingLogger() },
    );
  return { save, revalidate, revalidation, store, calls, options };
}
