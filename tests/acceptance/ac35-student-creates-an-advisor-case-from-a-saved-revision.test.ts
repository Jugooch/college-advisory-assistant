/**
 * @file Acceptance AC35 (planning/13, ADR-0013 §6-7): a student creates an advisor case from a
 * saved, possibly stale, plan revision through `POST /v1/students/:studentId/cases`. The case pins
 * that revision and shares only it and the student's note; nothing is written outside the case
 * rows. Reading the case as the assigned advisor is covered here; refusals (404, 400, 409) are in
 * the sibling file; the queue and actions are AC36, pending #412.
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-15
 * @requirement NFR-01
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { beforeEach, describe, expect } from 'vitest';

import {
  ACADEMIC_ACTORS,
  buildAcademicApp,
  createAcademicWorld,
} from '../support/academic-endpoints-harness';
import {
  type CasesWorld,
  createCase,
  listCases,
  openCase,
  planReviewBody,
  readCase,
  resetCasesWorld,
  saveRevision,
  STUDENT_NOTE,
  withoutFreshness,
} from '../support/cases-harness';
import { acceptanceIt } from '../support/known-findings';
import {
  dataOf,
  keysAndStrings,
  readPlanAt,
  storedPartOf,
  supersedeAudit,
} from '../support/plan-drafts-harness';

const world: CasesWorld = createAcademicWorld();

// NOTE: built once at module scope so Fastify's first build doesn't count against a case's timeout.
const app = buildAcademicApp(world);

describe('AC35 a student creates an advisor case from a saved revision', () => {
  beforeEach(() => {
    resetCasesWorld(world);
  });

  acceptanceIt(
    'AC35',
    'creates an OPEN unowned case with 201 that names the revision',
    async () => {
      const { revisionId, created } = await openCase(app);

      expect(created.statusCode).toBe(201);
      expect(dataOf(created)).toMatchObject({
        reason: 'PLAN_REVIEW',
        planRevisionId: revisionId,
        discrepancySubject: null,
        studentNote: STUDENT_NOTE,
        status: 'OPEN',
        owner: null,
        lastSequence: 1,
      });
    },
  );

  acceptanceIt('AC35', 'records one CREATE event by the student as the history', async () => {
    const { created } = await openCase(app);

    expect(dataOf(created).events).toMatchObject([
      {
        sequence: 1,
        action: 'CREATE',
        actorRole: 'STUDENT',
        isYou: true,
        fromStatus: null,
        toStatus: 'OPEN',
        resolution: null,
        note: null,
      },
    ]);
    expect(dataOf(created).events).toHaveLength(1);
  });

  acceptanceIt('AC35', 'offers the student only WITHDRAW on their open case', async () => {
    const { created } = await openCase(app);

    expect(dataOf(created).allowedActions).toEqual(['WITHDRAW']);
  });

  acceptanceIt(
    'AC35',
    'shows the revision as stored, equal to the plan revision the student saved',
    async () => {
      const { planId, created } = await openCase(app);

      const stored = await readPlanAt(app, `/${planId}/revisions/1`);

      const context = withoutFreshness(dataOf(created).context);
      expect(context).toEqual(storedPartOf(stored));
    },
  );

  acceptanceIt('AC35', 'creates a case from a stale revision and shows it STALE', async () => {
    const { revisionId } = await saveRevision(app);
    supersedeAudit(world);

    const created = await createCase(app, planReviewBody(revisionId));

    expect(created.statusCode).toBe(201);
    expect(dataOf(created).context).toMatchObject({
      id: revisionId,
      freshness: { state: 'STALE', reasons: ['AUDIT_SUPERSEDED'] },
    });
  });

  acceptanceIt(
    'AC35',
    'keeps showing the pinned revision, now STALE, after the sources change',
    async () => {
      const { planId, revisionId, caseId } = await openCase(app);
      const before = storedPartOf(await readPlanAt(app, `/${planId}/revisions/1`));
      supersedeAudit(world);

      const read = await readCase(app, caseId);

      expect(read.statusCode).toBe(200);
      expect(dataOf(read).planRevisionId).toBe(revisionId);
      expect(dataOf(read).context).toMatchObject({
        id: revisionId,
        freshness: { state: 'STALE', reasons: ['AUDIT_SUPERSEDED'] },
      });
      const context = withoutFreshness(dataOf(read).context);
      expect(context).toEqual(before);
    },
  );

  acceptanceIt('AC35', 'shares only the case fields, the revision and the note', async () => {
    const { created } = await openCase(app);

    expect(Object.keys(dataOf(created)).sort()).toEqual([
      'allowedActions',
      'context',
      'createdAt',
      'discrepancySubject',
      'events',
      'id',
      'lastSequence',
      'owner',
      'planRevisionId',
      'reason',
      'status',
      'studentId',
      'studentNote',
    ]);
  });

  acceptanceIt('AC35', 'shows no user ID, tenant or account field in the case view', async () => {
    const { created } = await openCase(app);
    const { keys, strings } = keysAndStrings(dataOf(created));

    const userIds: string[] = Object.values(ACADEMIC_ACTORS).map((identity) => identity.id);
    expect(strings.filter((value) => userIds.includes(value))).toEqual([]);
    expect(
      keys.filter((key) => ['createdBy', 'ownerUserId', 'actorUserId', 'tenantId'].includes(key)),
    ).toEqual([]);
  });

  acceptanceIt('AC35', 'returns the same case when it is read back by the student', async () => {
    const { created, caseId } = await openCase(app);

    const read = await readCase(app, caseId);

    expect(read.statusCode).toBe(200);
    expect(dataOf(read)).toEqual(dataOf(created));
  });

  acceptanceIt('AC35', 'lists the case on the student own list without its context', async () => {
    const { revisionId, caseId } = await openCase(app);

    const listed = await listCases(app);

    expect(listed.statusCode).toBe(200);
    expect(dataOf(listed).cases).toEqual([
      {
        id: caseId,
        reason: 'PLAN_REVIEW',
        planRevisionId: revisionId,
        discrepancySubject: null,
        status: 'OPEN',
        createdAt: '2026-09-01T12:00:00.000Z',
      },
    ]);
  });

  acceptanceIt('AC35', 'serves the assigned advisor the case with CLAIM allowed', async () => {
    const { caseId } = await openCase(app);

    const read = await readCase(app, caseId, 'advisor');

    expect(read.statusCode).toBe(200);
    expect(dataOf(read)).toMatchObject({
      status: 'OPEN',
      owner: null,
      allowedActions: ['CLAIM'],
      events: [{ action: 'CREATE', actorRole: 'STUDENT', isYou: false }],
    });
  });

  acceptanceIt('AC35', 'serves the assigned advisor the student case list', async () => {
    await openCase(app);

    const listed = await listCases(app, { actor: 'advisor' });

    expect(listed.statusCode).toBe(200);
    expect(dataOf(listed).cases).toHaveLength(1);
  });
});
