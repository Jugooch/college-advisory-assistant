/**
 * @file Acceptance AC36 (planning/13, ADR-0013 §6-7), resolve: only the owner resolves; a
 * resolution is advice that changes no plan revision, check or source row and creates no waiver;
 * RESOLVED is final. The queue and claims are in the sibling file.
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-17
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { buildAdvisorAssignment } from '@caa/test-kit';

import {
  ACADEMIC_ACTORS,
  buildAcademicApp,
  createAcademicWorld,
} from '../support/academic-endpoints-harness';
import { summarizeError } from '../support/api-harness';
import {
  actAs,
  actOnCase,
  type CaseActionBody,
  type CasesWorld,
  claimedCase,
  createCase,
  INVALID,
  NOT_FOUND,
  openCase,
  planReviewBody,
  readCase,
  resetCasesWorld,
} from '../support/cases-harness';
import { acceptanceIt } from '../support/known-findings';
import { dataOf, readPlanAt } from '../support/plan-drafts-harness';

const world: CasesWorld = createAcademicWorld();

// NOTE: built once at module scope so Fastify's first build doesn't count against a case's timeout.
const app = buildAcademicApp(world);

const RESOLVE_REVIEWED: CaseActionBody = {
  action: 'RESOLVE',
  expectedSequence: 2,
  resolution: 'PLAN_REVIEWED',
  note: 'The plan fits your program.',
};

/** Everything but the case rows, as plain data, to compare before and after an action. */
function nonCaseData(): string {
  return JSON.stringify(world, (key, value: unknown) =>
    key === 'cases' || key === 'caseEvents' ? undefined : value,
  );
}

describe('AC36 an advisor resolves a case', () => {
  beforeEach(() => {
    resetCasesWorld(world);
    world.assignments = [buildAdvisorAssignment()];
  });

  describe('who may resolve', () => {
    acceptanceIt('AC36', 'gives a non-owner assigned advisor 404 and changes nothing', async () => {
      world.assignments = [
        buildAdvisorAssignment(),
        buildAdvisorAssignment({ advisorUserId: ACADEMIC_ACTORS.unassignedAdvisor.id }, 2),
      ];
      const { caseId } = await claimedCase(app);

      const refused = await actAs(app, 'unassignedAdvisor')(caseId, RESOLVE_REVIEWED);

      expect(summarizeError(refused)).toMatchObject(NOT_FOUND);
      expect(world.cases?.[0]).toMatchObject({ status: 'IN_REVIEW', lastSequence: 2 });
      expect(world.caseEvents).toHaveLength(2);
    });

    acceptanceIt('AC36', 'gives the student 404 when resolving their own case', async () => {
      const { caseId } = await claimedCase(app);

      const refused = await actAs(app, 'student')(caseId, RESOLVE_REVIEWED);

      expect(summarizeError(refused)).toMatchObject(NOT_FOUND);
      expect(world.cases?.[0]).toMatchObject({ status: 'IN_REVIEW', lastSequence: 2 });
    });

    acceptanceIt('AC36', 'refuses to resolve an open case nobody claimed', async () => {
      const { caseId } = await openCase(app);

      const refused = await actOnCase(app, caseId, { ...RESOLVE_REVIEWED, expectedSequence: 1 });

      expect(summarizeError(refused)).toMatchObject(NOT_FOUND);
      expect(world.cases?.[0]).toMatchObject({ status: 'OPEN', lastSequence: 1 });
    });
  });

  describe('a resolution', () => {
    acceptanceIt('AC36', 'lets the owner resolve, keeping them as owner', async () => {
      const { caseId } = await claimedCase(app);

      const resolved = await actOnCase(app, caseId, RESOLVE_REVIEWED);

      expect(resolved.statusCode).toBe(201);
      expect(dataOf(resolved)).toMatchObject({
        status: 'RESOLVED',
        owner: { role: 'ADVISOR', isYou: true },
        lastSequence: 3,
        allowedActions: [],
        events: [
          { action: 'CREATE' },
          { action: 'CLAIM' },
          {
            action: 'RESOLVE',
            sequence: 3,
            fromStatus: 'IN_REVIEW',
            toStatus: 'RESOLVED',
            resolution: 'PLAN_REVIEWED',
            note: 'The plan fits your program.',
          },
        ],
      });
    });

    describe.each(['STUDENT_ACTION_NEEDED', 'REFERRED_OUTSIDE_APP'] as const)(
      'with %s',
      (resolution) => {
        acceptanceIt('AC36', `records ${resolution} as the resolution`, async () => {
          const { caseId } = await claimedCase(app);

          const resolved = await actOnCase(app, caseId, {
            action: 'RESOLVE',
            expectedSequence: 2,
            resolution,
          });

          expect(resolved.statusCode).toBe(201);
          expect(dataOf(resolved).events).toMatchObject([{}, {}, { resolution, note: null }]);
        });
      },
    );

    acceptanceIt('AC36', 'gives RESOLVE without a resolution 400', async () => {
      const { caseId } = await claimedCase(app);

      const refused = await actOnCase(app, caseId, { action: 'RESOLVE', expectedSequence: 2 });

      expect(summarizeError(refused)).toMatchObject(INVALID);
      expect(world.cases?.[0]).toMatchObject({ status: 'IN_REVIEW' });
    });

    acceptanceIt('AC36', 'gives a resolution on another action 400', async () => {
      const { caseId } = await claimedCase(app);

      const refused = await actOnCase(app, caseId, {
        action: 'RELEASE',
        expectedSequence: 2,
        resolution: 'PLAN_REVIEWED',
      });

      expect(summarizeError(refused)).toMatchObject(INVALID);
      expect(world.cases?.[0]).toMatchObject({ status: 'IN_REVIEW' });
    });

    acceptanceIt('AC36', 'accepts a note of 1,000 characters and refuses 1,001', async () => {
      const { caseId } = await claimedCase(app);
      const body = { ...RESOLVE_REVIEWED };

      const tooLong = await actOnCase(app, caseId, { ...body, note: 'a'.repeat(1001) });
      const longest = await actOnCase(app, caseId, { ...body, note: 'a'.repeat(1000) });

      expect(summarizeError(tooLong)).toMatchObject(INVALID);
      expect(longest.statusCode).toBe(201);
    });

    acceptanceIt('AC36', 'shows the student the resolution and its note', async () => {
      const { caseId } = await claimedCase(app);
      await actOnCase(app, caseId, RESOLVE_REVIEWED);

      const read = await readCase(app, caseId);

      expect(dataOf(read)).toMatchObject({
        status: 'RESOLVED',
        owner: { role: 'ADVISOR', isYou: false },
        events: [{}, {}, { resolution: 'PLAN_REVIEWED', note: 'The plan fits your program.' }],
      });
    });

    acceptanceIt('AC36', 'leaves every plan revision and check unchanged', async () => {
      const { caseId, planId } = await claimedCase(app);
      const revisionBefore = await readPlanAt(app, `/${planId}/revisions/1`);
      const planBefore = await readPlanAt(app, `/${planId}`);
      const dataBefore = nonCaseData();

      await actOnCase(app, caseId, RESOLVE_REVIEWED);

      expect(await readPlanAt(app, `/${planId}/revisions/1`)).toEqual(revisionBefore);
      expect(await readPlanAt(app, `/${planId}`)).toEqual(planBefore);
      expect(nonCaseData()).toBe(dataBefore);
    });
  });

  describe('RESOLVED is final', () => {
    const afterResolved: readonly [string, CaseActionBody, 'advisor' | 'student'][] = [
      ['CLAIM', { action: 'CLAIM', expectedSequence: 3 }, 'advisor'],
      ['RELEASE', { action: 'RELEASE', expectedSequence: 3 }, 'advisor'],
      ['RESOLVE', { ...RESOLVE_REVIEWED, expectedSequence: 3 }, 'advisor'],
      ['WITHDRAW', { action: 'WITHDRAW', expectedSequence: 3 }, 'student'],
    ];

    describe.each(afterResolved)('%s', (name, body, actor) => {
      acceptanceIt('AC36', `refuses ${name} after RESOLVED and changes nothing`, async () => {
        const { caseId } = await claimedCase(app);
        await actOnCase(app, caseId, RESOLVE_REVIEWED);
        const before = JSON.stringify([world.cases, world.caseEvents]);

        const refused = await actAs(app, actor)(caseId, body);

        expect(refused.statusCode).toBe(400);
        expect(JSON.stringify([world.cases, world.caseEvents])).toBe(before);
      });
    });

    acceptanceIt('AC36', 'lets the student open a new case on the same plan', async () => {
      const { caseId, revisionId } = await claimedCase(app);
      await actOnCase(app, caseId, RESOLVE_REVIEWED);

      const created = await createCase(app, planReviewBody(revisionId, 'One more question.'));

      expect(created.statusCode).toBe(201);
    });
  });
});
