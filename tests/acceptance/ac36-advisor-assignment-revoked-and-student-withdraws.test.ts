/**
 * @file Acceptance AC36 (planning/13, ADR-0013 §6-7, AC15), revocation and withdrawal: when the
 * advisor's assignment ends between claim and resolve, the next action and read are 404 and the
 * case is unrouted for an admin; the student withdraws an open or in-review case, an advisor
 * can't, and the body can't name an owner, status or tenant.
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-15
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { Role } from '@caa/domain';
import { buildAdvisorAssignment, buildUserIdentity } from '@caa/test-kit';

import {
  ACADEMIC_ACTORS,
  buildAcademicApp,
  createAcademicWorld,
} from '../support/academic-endpoints-harness';
import { buildAcceptanceApp, getAs, summarizeError } from '../support/api-harness';
import {
  actAs,
  actOnCase,
  type CasesWorld,
  claimedCase,
  createCase,
  INVALID,
  NOT_FOUND,
  openCase,
  planReviewBody,
  readCase,
  readQueue,
  resetCasesWorld,
  REVOKED_AT,
} from '../support/cases-harness';
import { acceptanceIt } from '../support/known-findings';
import { dataOf } from '../support/plan-drafts-harness';

const world: CasesWorld = createAcademicWorld();

// NOTE: built once at module scope so Fastify's first build doesn't count against a case's timeout.
const app = buildAcademicApp(world);

const ADMIN = buildUserIdentity({ roles: [Role.Admin] }, 7);
const adminApp = buildAcceptanceApp(world, [{ token: 'academic-admin', identity: ADMIN }]);

/**
 * Reads the queue as an admin of tenant A.
 *
 * @param query - Query string including the `?`.
 * @returns The response.
 */
function readQueueAsAdmin(query: string) {
  return getAs(adminApp, `/v1/advisor/cases${query}`, 'Bearer academic-admin');
}

const RESOLVE = { action: 'RESOLVE', expectedSequence: 2, resolution: 'PLAN_REVIEWED' } as const;

/** Ends the advisor's assignment before the harness clock. */
function revokeAssignment(): void {
  world.assignments = [buildAdvisorAssignment({ effectiveTo: REVOKED_AT })];
}

describe('AC36 the assignment is revoked and the student withdraws', () => {
  beforeEach(() => {
    resetCasesWorld(world);
    world.assignments = [buildAdvisorAssignment()];
    world.identities = [...Object.values(ACADEMIC_ACTORS), ADMIN];
  });

  describe('assignment revoked between claim and resolve', () => {
    acceptanceIt('AC36', 'gives the former owner 404 when resolving (AC15)', async () => {
      const { caseId } = await claimedCase(app);
      revokeAssignment();

      const refused = await actOnCase(app, caseId, RESOLVE);

      expect(summarizeError(refused)).toMatchObject(NOT_FOUND);
      expect(world.cases?.[0]).toMatchObject({ status: 'IN_REVIEW', lastSequence: 2 });
      expect(world.caseEvents).toHaveLength(2);
    });

    acceptanceIt('AC36', 'gives the former owner 404 when reading the case', async () => {
      const { caseId } = await claimedCase(app);
      revokeAssignment();

      const read = await readCase(app, caseId, 'advisor');

      expect(summarizeError(read)).toMatchObject(NOT_FOUND);
    });

    acceptanceIt('AC36', 'drops the case from the former owner queue', async () => {
      await claimedCase(app);
      revokeAssignment();

      const queue = await readQueue(app);

      expect(dataOf(queue).cases).toEqual([]);
    });

    acceptanceIt('AC36', 'shows the student the case still', async () => {
      const { caseId } = await claimedCase(app);
      revokeAssignment();

      const read = await readCase(app, caseId);

      expect(read.statusCode).toBe(200);
      expect(dataOf(read)).toMatchObject({ status: 'IN_REVIEW' });
    });

    acceptanceIt('AC36', 'marks the case unrouted for an admin', async () => {
      const { caseId } = await openCase(app);
      revokeAssignment();

      const queue = await readQueueAsAdmin('?unrouted=true');

      expect(dataOf(queue).cases).toMatchObject([{ caseId, routed: false }]);
    });
  });

  describe('withdraw', () => {
    acceptanceIt('AC36', 'lets the student withdraw an open case', async () => {
      const { caseId } = await openCase(app);

      const withdrawn = await actAs(app, 'student')(caseId, {
        action: 'WITHDRAW',
        expectedSequence: 1,
      });

      expect(withdrawn.statusCode).toBe(201);
      expect(dataOf(withdrawn)).toMatchObject({
        status: 'WITHDRAWN',
        owner: null,
        allowedActions: [],
      });
    });

    acceptanceIt(
      'AC36',
      'lets the student withdraw a case in review, clearing the owner',
      async () => {
        const { caseId } = await claimedCase(app);

        const withdrawn = await actAs(app, 'student')(caseId, {
          action: 'WITHDRAW',
          expectedSequence: 2,
        });

        expect(dataOf(withdrawn)).toMatchObject({
          status: 'WITHDRAWN',
          owner: null,
          lastSequence: 3,
        });
      },
    );

    acceptanceIt('AC36', 'makes WITHDRAWN final and lets the student open a new case', async () => {
      const { caseId, revisionId } = await openCase(app);
      await actAs(app, 'student')(caseId, { action: 'WITHDRAW', expectedSequence: 1 });

      const claim = await actOnCase(app, caseId, { action: 'CLAIM', expectedSequence: 2 });
      const again = await createCase(app, planReviewBody(revisionId));

      expect(claim.statusCode).toBe(400);
      expect(again.statusCode).toBe(201);
    });

    acceptanceIt('AC36', 'gives an advisor 404 when withdrawing a student case', async () => {
      const { caseId } = await openCase(app);

      const refused = await actOnCase(app, caseId, { action: 'WITHDRAW', expectedSequence: 1 });

      expect(summarizeError(refused)).toMatchObject(NOT_FOUND);
      expect(world.cases?.[0]).toMatchObject({ status: 'OPEN' });
    });
  });

  describe('event body safety', () => {
    describe.each(['tenantId', 'ownerUserId', 'status', 'actorUserId', 'role'])(
      'with %s',
      (field) => {
        acceptanceIt('AC36', `gives a body naming ${field} 400 and writes nothing`, async () => {
          const { caseId } = await openCase(app);

          const refused = await actOnCase(app, caseId, {
            action: 'CLAIM',
            expectedSequence: 1,
            [field]: 'x',
          });

          expect(summarizeError(refused)).toMatchObject(INVALID);
          expect(world.caseEvents).toHaveLength(1);
        });
      },
    );

    acceptanceIt('AC36', 'gives the CREATE action on the events endpoint 400', async () => {
      const { caseId } = await openCase(app);

      const refused = await actOnCase(app, caseId, { action: 'CREATE', expectedSequence: 1 });

      expect(summarizeError(refused)).toMatchObject(INVALID);
      expect(world.caseEvents).toHaveLength(1);
    });
  });
});
