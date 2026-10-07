/**
 * @file Builds synthetic plan revision views and plan views in the #403 contract shape. The
 *   builders parse their result with the contract schema, so a result that doesn't match the
 *   revision (pinned inputs, courses, outcome, selection) fails where it is built.
 * @module @caa/test-kit/builders/plan-revision-view
 */
import type { z } from 'zod';

import {
  type PlanRevisionView,
  PlanRevisionViewSchema,
  type PlanView,
  PlanViewSchema,
} from '@caa/api-contract';
import { PlanRevisionCause } from '@caa/domain';

import { buildPlan } from './plan.builder';
import { buildPlanFreshnessView } from './plan-freshness-view.builder';
import { buildPlanRevision } from './plan-revision.builder';
import { buildScheduleOption } from './schedule-option.builder';
import {
  buildScheduleOptionsResponse,
  SYNTHETIC_SCHEDULE_PINNED_INPUTS,
} from './schedule-options-response.builder';

/** Raw input accepted for a revision view, as the contract schema reads it. */
export type PlanRevisionViewInput = z.input<typeof PlanRevisionViewSchema>;

/**
 * Builds a valid revision view: a first `OPTIONS_FOUND` revision of plan seed 1 with `CURRENT`
 * freshness and no `createdBy`. Its result is the default one-option response, and its pinned
 * inputs and selection (the option's one section) match that result.
 *
 * Override stored fields freely; the default result follows the revision's pinned inputs. A
 * result for another outcome, courses or selection must be given with them.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes revisions; drives the default `id`.
 * @returns The view, parsed by the contract.
 */
export function buildPlanRevisionView(
  overrides: Partial<PlanRevisionViewInput> = {},
  seed = 1,
): PlanRevisionView {
  const {
    result,
    resultUnavailable: isUnavailableOverride,
    freshness,
    ...storedOverrides
  } = overrides;
  const option = buildScheduleOption();
  const sectionIds = option.bundles
    .flatMap((bundle) => bundle.sections.map((section) => section.sectionId))
    .sort();
  const revision = buildPlanRevision(
    {
      ...SYNTHETIC_SCHEDULE_PINNED_INPUTS,
      courseIds: option.bundles.map((bundle) => bundle.courseId),
      selectedSectionIds: sectionIds,
      ...storedOverrides,
    },
    seed,
  );
  // `createdBy` is the student's user ID; a view never carries it (ADR-0013 §6).
  const stored = Object.fromEntries(
    Object.entries(revision).filter(([key]) => key !== 'createdBy'),
  );
  const defaultResult = buildScheduleOptionsResponse({
    options: [option],
    pinnedInputs: {
      studentSnapshotId: revision.studentSnapshotId,
      studentRecordEffectiveAt: revision.studentRecordEffectiveAt,
      auditRecordEffectiveAt: revision.auditRecordEffectiveAt,
      auditSource: revision.auditSource,
      auditVersion: revision.auditVersion,
      rulesetVersion: revision.rulesetVersion,
      sectionSnapshotId: revision.sectionSnapshotId,
      campusTransitionVersion: revision.campusTransitionVersion,
      solverWorkCap: revision.solverWorkCap,
      constraintHash: revision.constraintHash,
    },
  });
  const shownResult = result === undefined ? defaultResult : result;
  return PlanRevisionViewSchema.parse({
    ...stored,
    result: shownResult,
    resultUnavailable: isUnavailableOverride ?? shownResult === null,
    freshness: freshness ?? buildPlanFreshnessView(),
  });
}

/**
 * Builds a revision view whose stored result no longer parses: `result` is `null` and
 * `resultUnavailable` is `true` (ADR-0013 §2). The stored selection and outcome are kept.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes revisions; drives the default `id`.
 * @returns The view, parsed by the contract.
 */
export function buildResultUnavailablePlanRevisionView(
  overrides: Partial<PlanRevisionViewInput> = {},
  seed = 1,
): PlanRevisionView {
  return buildPlanRevisionView({ result: null, resultUnavailable: true, ...overrides }, seed);
}

/** Raw input accepted for a plan view, as the contract schema reads it. */
export type PlanViewInput = z.input<typeof PlanViewSchema>;

/**
 * Builds a valid plan view with a single saved revision as `latest`. By default the plan is
 * plan seed 1 and its index lists revision 1 (`SAVED`).
 *
 * When `latest` is given with a revision number above 1, the index is filled to match: earlier
 * revisions are `SAVED` at the plan's creation time, and the last entry copies `latest`.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes plans; drives the default `id`.
 * @returns The view, parsed by the contract.
 */
export function buildPlanView(overrides: Partial<PlanViewInput> = {}, seed = 1): PlanView {
  const plan = buildPlan({}, seed);
  const latest = PlanRevisionViewSchema.parse(
    overrides.latest ?? buildPlanRevisionView({ planId: plan.id }),
  );
  const createdAt = latest.revision === 1 ? latest.createdAt : plan.createdAt;
  const earlier = Array.from({ length: latest.revision - 1 }, (_, index) => ({
    revision: index + 1,
    cause: PlanRevisionCause.Saved,
    createdAt,
  }));
  return PlanViewSchema.parse({
    id: latest.planId,
    termId: latest.termId,
    createdAt,
    revisions: [
      ...earlier,
      { revision: latest.revision, cause: latest.cause, createdAt: latest.createdAt },
    ],
    ...overrides,
    latest,
  });
}
