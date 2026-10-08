/**
 * @file Acceptance AC41 (planning/14 §First vertical slice, T01, T07): fictional student A sees
 * two feasible options with evidence, saves one as a draft, a newer audit is published and the
 * draft reads STALE, the student creates a case from the stale revision, the assigned advisor
 * claims and resolves it, and the student sees the resolution. The newer audit is the harness
 * equivalent of the #408 publish path.
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-15
 * @see docs/planning/14-first-vertical-slice.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import {
  actOnCase,
  type CasesWorld,
  createCase,
  planReviewBody,
  readCase,
  readQueue,
  resetCasesWorld,
  saveRevision,
} from '../support/cases-harness';
import { acceptanceIt } from '../support/known-findings';
import {
  dataOf,
  latestFreshness,
  MATH_ALT,
  MATH_MWF,
  PHYS_TTH,
  readPlanAt,
  supersedeAudit,
  viewDefaultOptions,
} from '../support/plan-drafts-harness';
import { publishSections } from '../support/schedule-options-harness';

const world: CasesWorld = createAcademicWorld();

// NOTE: built once at module scope so Fastify's first build doesn't count against a case's timeout.
const app = buildAcademicApp(world);

describe('AC41 the first vertical slice through advisor review', () => {
  beforeEach(() => {
    resetCasesWorld(world);
    publishSections(world, [MATH_MWF, PHYS_TTH, MATH_ALT]);
  });

  acceptanceIt(
    'AC41',
    'runs from two options to a resolution the student reads, with the plan unchanged',
    async () => {
      const shown = await viewDefaultOptions(app);
      expect(dataOf(shown)).toMatchObject({
        outcome: 'OPTIONS_FOUND',
        options: [
          { rank: 1, scheduleFeasibility: { state: 'PASS' }, aggregate: 'VALIDATED' },
          { rank: 2, scheduleFeasibility: { state: 'PASS' }, aggregate: 'VALIDATED' },
        ],
      });
      const { planId, revisionId } = await saveRevision(app);
      expect(latestFreshness(await readPlanAt(app, `/${planId}`))).toMatchObject({
        state: 'CURRENT',
      });

      supersedeAudit(world);
      expect(latestFreshness(await readPlanAt(app, `/${planId}`))).toMatchObject({
        state: 'STALE',
      });
      const created = await createCase(app, planReviewBody(revisionId));
      const caseId = String(dataOf(created).id);
      expect(dataOf(created)).toMatchObject({
        status: 'OPEN',
        context: { id: revisionId, freshness: { state: 'STALE' } },
      });

      const queue = await readQueue(app);
      expect(dataOf(queue).cases).toMatchObject([{ caseId, status: 'OPEN', routed: true }]);
      const planBefore = await readPlanAt(app, `/${planId}/revisions/1`);
      await actOnCase(app, caseId, { action: 'CLAIM', expectedSequence: 1 });
      const resolved = await actOnCase(app, caseId, {
        action: 'RESOLVE',
        expectedSequence: 2,
        resolution: 'STUDENT_ACTION_NEEDED',
        note: 'Please refresh your plan before you register.',
      });

      expect(resolved.statusCode).toBe(201);
      const read = await readCase(app, caseId);
      expect(dataOf(read)).toMatchObject({
        status: 'RESOLVED',
        events: [
          {},
          {},
          {
            resolution: 'STUDENT_ACTION_NEEDED',
            note: 'Please refresh your plan before you register.',
          },
        ],
      });
      expect(await readPlanAt(app, `/${planId}/revisions/1`)).toEqual(planBefore);
    },
  );
});
