/**
 * @file Builds synthetic plan revisions for tests.
 * @module @caa/test-kit/builders/plan-revision
 */
import {
  createPlanRevision,
  type PlanRevision,
  PlanRevisionCause,
  type PlanRevisionInput,
  ScheduleOutcome,
} from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { SYNTHETIC_SCHEDULE_TERM } from '../fixtures/synthetic-schedule-term';
import { buildScheduleConstraintSet } from './schedule-constraint.builder';

/**
 * Builds a valid first revision with an `OPTIONS_FOUND` outcome and a sorted two-section
 * selection.
 *
 * Defaults: plan seed 1, saved by user seed 2, one course, no credit selections, no constraints,
 * and snapshots seeded 1.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes revisions; drives the default `id`.
 * @returns A validated plan revision.
 */
export function buildPlanRevision(
  overrides: Partial<PlanRevisionInput> = {},
  seed = 1,
): PlanRevision {
  return createPlanRevision({
    id: syntheticId('planRevision', seed),
    planId: syntheticId('plan', 1),
    revision: 1,
    cause: PlanRevisionCause.Saved,
    createdBy: syntheticId('user', 2),
    createdAt: '2026-09-21T09:00:00.000-05:00',
    termId: SYNTHETIC_SCHEDULE_TERM.termId,
    courseIds: [syntheticId('course', 1)],
    creditSelections: [],
    constraints: buildScheduleConstraintSet(),
    studentSnapshotId: syntheticId('studentSnapshot', 1),
    studentRecordEffectiveAt: '2026-09-20T07:30:00.000-05:00',
    auditRecordEffectiveAt: '2026-09-20T07:30:00.000-05:00',
    auditSnapshotId: syntheticId('audit', 1),
    auditSource: 'demo-audit',
    auditVersion: 'audit_demo_r1',
    rulesetVersion: 'ruleset_demo_r1',
    sectionSnapshotId: syntheticId('sectionSnapshot', 1),
    campusTransitionVersion: null,
    solverWorkCap: 100_000,
    constraintHash: `sha256:${'0a'.repeat(32)}`,
    outcome: ScheduleOutcome.OptionsFound,
    selectedSectionIds: [syntheticId('section', 1), syntheticId('section', 2)],
    ...overrides,
  });
}

/**
 * Builds a valid revision whose outcome has no options (`NO_FEASIBLE_PLAN`) and so has a `null`
 * selection.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes revisions; drives the default `id`.
 * @returns A validated plan revision with no selected sections.
 */
export function buildNoOptionsPlanRevision(
  overrides: Partial<PlanRevisionInput> = {},
  seed = 1,
): PlanRevision {
  return buildPlanRevision(
    { outcome: ScheduleOutcome.NoFeasiblePlan, selectedSectionIds: null, ...overrides },
    seed,
  );
}
