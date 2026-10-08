/**
 * @file Acceptance AC36 (planning/13, ADR-0013 §6-7), queue, claim and release: the assigned
 * advisor sees an open case and an unassigned one doesn't; two claims racing give one winner;
 * the owner releases; a non-owner can't. Resolving, assignment revocation and withdrawal are in
 * the sibling files.
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-14
 * @requirement NFR-01
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
  type CasesWorld,
  claimedCase,
  NOT_FOUND,
  openCase,
  readCase,
  readQueue,
  resetCasesWorld,
  STUDENT_NOTE,
} from '../support/cases-harness';
import { acceptanceIt } from '../support/known-findings';
import { dataOf } from '../support/plan-drafts-harness';

const world: CasesWorld = createAcademicWorld();

// NOTE: built once at module scope so Fastify's first build doesn't count against a case's timeout.
const app = buildAcademicApp(world);

/** Lets a second advisor hold an active assignment to the same student. */
function assignSecondAdvisor(): void {
  world.assignments = [
    buildAdvisorAssignment(),
    buildAdvisorAssignment({ advisorUserId: ACADEMIC_ACTORS.unassignedAdvisor.id }, 2),
  ];
}

describe('AC36 advisors work the case queue', () => {
  beforeEach(() => {
    resetCasesWorld(world);
    world.assignments = [buildAdvisorAssignment()];
  });

  describe('queue', () => {
    acceptanceIt('AC36', 'lists the open case to the advisor assigned to the student', async () => {
      const { caseId } = await openCase(app);

      const queue = await readQueue(app);

      expect(queue.statusCode).toBe(200);
      expect(dataOf(queue).cases).toEqual([
        {
          caseId,
          studentId: '30000000-0000-4000-8000-000000000001',
          reason: 'PLAN_REVIEW',
          status: 'OPEN',
          createdAt: '2026-09-01T12:00:00.000Z',
          ownerIsYou: false,
          routed: true,
        },
      ]);
    });

    acceptanceIt('AC36', 'does not list the case to an advisor with no assignment', async () => {
      await openCase(app);

      const queue = await readQueue(app, '', 'unassignedAdvisor');

      expect(queue.statusCode).toBe(200);
      expect(dataOf(queue).cases).toEqual([]);
    });

    acceptanceIt('AC36', 'filters the queue to cases in review', async () => {
      const { caseId } = await claimedCase(app);

      const inReview = await readQueue(app, '?status=IN_REVIEW');
      const open = await readQueue(app, '?status=OPEN');

      expect(dataOf(inReview).cases).toMatchObject([{ caseId, ownerIsYou: true }]);
      expect(dataOf(open).cases).toEqual([]);
    });

    acceptanceIt('AC36', 'gives a student 404 for the queue', async () => {
      await openCase(app);

      const asStudent = await readQueue(app, '', 'student');

      expect(summarizeError(asStudent)).toMatchObject(NOT_FOUND);
    });

    acceptanceIt('AC36', 'shows an admin of another tenant none of the case', async () => {
      await openCase(app);

      const queue = await readQueue(app, '', 'tenantBAdmin');

      expect(queue.statusCode).toBe(200);
      expect(dataOf(queue).cases).toEqual([]);
    });

    acceptanceIt('AC36', 'gives an advisor 404 for the admin-only unrouted view', async () => {
      await openCase(app);

      const unrouted = await readQueue(app, '?unrouted=true');

      expect(summarizeError(unrouted)).toMatchObject(NOT_FOUND);
    });

    acceptanceIt('AC36', 'carries no user ID, student name or student note in a row', async () => {
      await openCase(app);

      const queue = await readQueue(app);

      const body = JSON.stringify(dataOf(queue));
      expect(body).not.toContain(STUDENT_NOTE);
      for (const identity of Object.values(ACADEMIC_ACTORS)) {
        expect(body).not.toContain(identity.id);
      }
    });
  });

  describe('claim and release', () => {
    acceptanceIt('AC36', 'lets the assigned advisor claim, making them the owner', async () => {
      const { claimed } = await claimedCase(app);

      expect(claimed.statusCode).toBe(201);
      expect(dataOf(claimed)).toMatchObject({
        status: 'IN_REVIEW',
        owner: { role: 'ADVISOR', isYou: true },
        lastSequence: 2,
        allowedActions: ['RELEASE', 'RESOLVE'],
        events: [{ action: 'CREATE' }, { action: 'CLAIM', actorRole: 'ADVISOR', sequence: 2 }],
      });
    });

    acceptanceIt('AC36', 'gives exactly one of two racing claims the case', async () => {
      assignSecondAdvisor();
      const { caseId } = await openCase(app);
      const claim = { action: 'CLAIM', expectedSequence: 1 } as const;

      const results = await Promise.all([
        actOnCase(app, caseId, claim),
        actAs(app, 'unassignedAdvisor')(caseId, claim),
      ]);

      expect(results.map((result) => result.statusCode).toSorted()).toEqual([201, 409]);
      const [first, second] = results;
      const loser = first.statusCode === 409 ? first : second;
      expect(summarizeError(loser)).toMatchObject({ code: 'REVISION_CONFLICT' });
    });

    acceptanceIt(
      'AC36',
      'leaves one CLAIM event and the winner as owner after a race',
      async () => {
        assignSecondAdvisor();
        const { caseId } = await openCase(app);
        const claim = { action: 'CLAIM', expectedSequence: 1 } as const;
        await Promise.all([
          actOnCase(app, caseId, claim),
          actAs(app, 'unassignedAdvisor')(caseId, claim),
        ]);

        const events = world.caseEvents ?? [];
        const winner = events.find((event) => event.action === 'CLAIM')?.actorUserId;
        expect(events.filter((event) => event.action === 'CLAIM')).toHaveLength(1);
        expect(world.cases?.[0]).toMatchObject({ status: 'IN_REVIEW', ownerUserId: winner });
      },
    );

    acceptanceIt('AC36', 'gives a claim with a stale sequence 409 and writes nothing', async () => {
      const { caseId } = await openCase(app);

      const stale = await actOnCase(app, caseId, { action: 'CLAIM', expectedSequence: 7 });

      expect(summarizeError(stale)).toMatchObject({ statusCode: 409, code: 'REVISION_CONFLICT' });
      expect(world.caseEvents).toHaveLength(1);
    });

    acceptanceIt(
      'AC36',
      'gives an unassigned advisor 404 on claim and writes nothing',
      async () => {
        const { caseId } = await openCase(app);

        const claim = { action: 'CLAIM', expectedSequence: 1 } as const;
        const refused = await actAs(app, 'unassignedAdvisor')(caseId, claim);

        expect(summarizeError(refused)).toMatchObject(NOT_FOUND);
        expect(world.caseEvents).toHaveLength(1);
      },
    );

    acceptanceIt('AC36', 'gives a student 404 when claiming their own case', async () => {
      const { caseId } = await openCase(app);

      const refused = await actAs(app, 'student')(caseId, { action: 'CLAIM', expectedSequence: 1 });

      expect(summarizeError(refused)).toMatchObject(NOT_FOUND);
      expect(world.caseEvents).toHaveLength(1);
    });

    acceptanceIt('AC36', 'lets the owner release the case back to OPEN with no owner', async () => {
      const { caseId } = await claimedCase(app);

      const released = await actOnCase(app, caseId, { action: 'RELEASE', expectedSequence: 2 });

      expect(released.statusCode).toBe(201);
      expect(dataOf(released)).toMatchObject({ status: 'OPEN', owner: null, lastSequence: 3 });
    });

    acceptanceIt('AC36', 'gives another assigned advisor 404 when releasing', async () => {
      assignSecondAdvisor();
      const { caseId } = await claimedCase(app);

      const release = { action: 'RELEASE', expectedSequence: 2 } as const;
      const refused = await actAs(app, 'unassignedAdvisor')(caseId, release);

      expect(summarizeError(refused)).toMatchObject(NOT_FOUND);
      expect(world.cases?.[0]).toMatchObject({ status: 'IN_REVIEW', lastSequence: 2 });
    });

    acceptanceIt(
      'AC36',
      'shows the student the case in review with a role-only owner',
      async () => {
        const { caseId } = await claimedCase(app);

        const read = await readCase(app, caseId);

        expect(dataOf(read)).toMatchObject({
          status: 'IN_REVIEW',
          owner: { role: 'ADVISOR', isYou: false },
          allowedActions: ['WITHDRAW'],
        });
        expect(JSON.stringify(dataOf(read))).not.toContain(ACADEMIC_ACTORS.advisor.id);
      },
    );
  });
});
