/**
 * @file Composition root for saved plans: saves, views, and revalidation.
 * @module @caa/api/wiring/plans
 * @see docs/adr/0014-api-composition-root-wiring-files.md
 */
import type { ContainerOptions } from '../container';
import type { AccessService } from '../modules/access/access.service';
import {
  createPlanDraftsController,
  type PlanDraftsController,
} from '../modules/plan-drafts/plan-drafts.controller';
import { createPlanDraftsService } from '../modules/plan-drafts/plan-drafts.service';
import { createPlanFreshnessService } from '../modules/plan-freshness/plan-freshness.service';
import {
  createPlanRevalidationController,
  type PlanRevalidationController,
} from '../modules/plan-revalidation/plan-revalidation.controller';
import { createPlanRevalidationService } from '../modules/plan-revalidation/plan-revalidation.service';
import { createPlanRevisionsService } from '../modules/plan-revisions/plan-revisions.service';
import {
  createPlanViewsController,
  type PlanViewsController,
} from '../modules/plan-views/plan-views.controller';
import {
  createPlanViewsService,
  type PlanViewsService,
} from '../modules/plan-views/plan-views.service';
import type { ScheduleOptionsService } from '../modules/schedule-options/schedule-options.service';

/** What {@link wirePlans} builds: the plan controllers and the views other areas read through. */
export interface PlansWiring {
  readonly planDrafts: PlanDraftsController;
  readonly planRevalidation: PlanRevalidationController;
  readonly planViews: PlanViewsController;
  /** The plan views service, which a case reads its frozen revision through. */
  readonly views: PlanViewsService;
}

/**
 * Builds the plan services and their controllers. A save replays schedule options and a read
 * derives freshness.
 *
 * @param options - Configuration, repositories, and clock.
 * @param access - The access rule, including who may author a plan.
 * @param scheduleOptions - The existing schedule options service the save replays.
 * @returns The plan controllers and the plan views service.
 */
export function wirePlans(
  options: ContainerOptions,
  access: AccessService,
  scheduleOptions: ScheduleOptionsService,
): PlansWiring {
  const { env, repositories, now } = options;
  const freshness = createPlanFreshnessService({
    studentSnapshots: repositories.studentSnapshots,
    auditSnapshots: repositories.auditSnapshots,
    sectionSnapshots: repositories.sectionSnapshots,
    campusTransitions: repositories.campusTransitions,
    now,
    maxSourceAgeMs: env.ACADEMIC_SOURCE_MAX_AGE_MS,
    rulesetVersion: env.ACTIVE_RULESET_VERSION ?? null,
  });
  const views = createPlanViewsService({
    access,
    plans: repositories.plans,
    cases: repositories.cases,
    freshness,
  });
  const revisions = createPlanRevisionsService({
    scheduleOptions,
    auditSnapshots: repositories.auditSnapshots,
    plans: repositories.plans,
    views,
    now,
  });
  return {
    planDrafts: createPlanDraftsController(createPlanDraftsService({ access, revisions })),
    planRevalidation: createPlanRevalidationController(
      createPlanRevalidationService({ access, plans: repositories.plans, revisions }),
    ),
    planViews: createPlanViewsController(views),
    views,
  };
}
