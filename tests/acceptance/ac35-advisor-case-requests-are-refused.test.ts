/**
 * @file Acceptance AC35 (planning/13, ADR-0013 §6-7), refusals: another student, an unassigned
 * advisor or another tenant gets 404 for a case and cannot create one; a body naming a status,
 * owner, tenant, user or role is 400; invalid reasons and notes are 400; a second open case for
 * the same plan is 409 REVISION_CONFLICT; a refused create stores nothing.
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
import { summarizeError } from '../support/api-harness';
import {
  type CasesWorld,
  createCase,
  expectNoCaseWritten,
  INVALID,
  listCases,
  NOT_FOUND,
  openCase,
  planReviewBody,
  readCase,
  resetCasesWorld,
  saveRevision,
  UNKNOWN_REVISION_ID,
} from '../support/cases-harness';
import { acceptanceIt } from '../support/known-findings';

const world: CasesWorld = createAcademicWorld();

// NOTE: built once at module scope so Fastify's first build doesn't count against a case's timeout.
const app = buildAcademicApp(world);

describe('AC35 advisor case creation is refused', () => {
  beforeEach(() => {
    resetCasesWorld(world);
  });

  describe.each(['otherStudent', 'unassignedAdvisor', 'tenantBAdmin'] as const)(
    'as %s',
    (actor) => {
      acceptanceIt('AC35', `gives ${actor} 404 when reading the case`, async () => {
        const { caseId } = await openCase(app);

        const read = await readCase(app, caseId, actor);

        expect(summarizeError(read)).toMatchObject(NOT_FOUND);
      });

      acceptanceIt('AC35', `gives ${actor} 404 when listing the student cases`, async () => {
        await openCase(app);

        const listed = await listCases(app, { actor });

        expect(summarizeError(listed)).toMatchObject(NOT_FOUND);
      });

      acceptanceIt('AC35', `gives ${actor} 404 and stores nothing when creating one`, async () => {
        const { revisionId } = await saveRevision(app);

        const refused = await createCase(app, planReviewBody(revisionId), { actor });

        expect(summarizeError(refused)).toMatchObject(NOT_FOUND);
        expectNoCaseWritten(world);
      });
    },
  );

  acceptanceIt('AC35', 'gives the same 404 for a missing case as for a refused one', async () => {
    const { caseId } = await openCase(app);

    const refused = await readCase(app, caseId, 'otherStudent');
    const missing = await readCase(app, '80000000-0000-4000-8000-0000000003e7', 'otherStudent');

    expect(summarizeError(refused)).toEqual(summarizeError(missing));
  });

  acceptanceIt(
    'AC35',
    'refuses a revision that is not stored with 404 and stores nothing',
    async () => {
      const refused = await createCase(app, planReviewBody(UNKNOWN_REVISION_ID));

      expect(summarizeError(refused)).toMatchObject(NOT_FOUND);
      expectNoCaseWritten(world);
    },
  );

  describe.each(['status', 'ownerUserId', 'tenantId', 'userId', 'role'] as const)(
    'a body naming %s',
    (field) => {
      acceptanceIt(
        'AC35',
        `refuses a body naming ${field} with 400 and stores nothing`,
        async () => {
          const { revisionId } = await saveRevision(app);

          const refused = await createCase(app, {
            ...planReviewBody(revisionId),
            [field]: ACADEMIC_ACTORS.advisor.id,
          });

          expect(summarizeError(refused)).toMatchObject(INVALID);
          expectNoCaseWritten(world);
        },
      );
    },
  );

  acceptanceIt('AC35', 'refuses a plan review without a revision with 400', async () => {
    const refused = await createCase(app, {
      ...planReviewBody(UNKNOWN_REVISION_ID),
      planRevisionId: null,
    });

    expect(summarizeError(refused)).toMatchObject(INVALID);
    expectNoCaseWritten(world);
  });

  acceptanceIt(
    'AC35',
    'refuses a plan review that names a discrepancy subject with 400',
    async () => {
      const { revisionId } = await saveRevision(app);

      const refused = await createCase(app, {
        ...planReviewBody(revisionId),
        discrepancySubject: 'SECTION',
      });

      expect(summarizeError(refused)).toMatchObject(INVALID);
      expectNoCaseWritten(world);
    },
  );

  acceptanceIt('AC35', 'refuses an empty student note with 400', async () => {
    const { revisionId } = await saveRevision(app);

    const refused = await createCase(app, planReviewBody(revisionId, ''));

    expect(summarizeError(refused)).toMatchObject(INVALID);
    expectNoCaseWritten(world);
  });

  acceptanceIt('AC35', 'refuses a student note of 501 characters with 400', async () => {
    const { revisionId } = await saveRevision(app);

    const refused = await createCase(app, planReviewBody(revisionId, 'x'.repeat(501)));

    expect(summarizeError(refused)).toMatchObject(INVALID);
    expectNoCaseWritten(world);
  });

  acceptanceIt('AC35', 'accepts a student note of exactly 500 characters', async () => {
    const { revisionId } = await saveRevision(app);

    const created = await createCase(app, planReviewBody(revisionId, 'x'.repeat(500)));

    expect(created.statusCode).toBe(201);
  });

  acceptanceIt(
    'AC35',
    'refuses a second open case for the same plan with 409 REVISION_CONFLICT',
    async () => {
      const { revisionId } = await openCase(app);

      const second = await createCase(app, planReviewBody(revisionId, 'A second question.'));

      expect(summarizeError(second)).toMatchObject({
        statusCode: 409,
        bodyKeys: ['error'],
        code: 'REVISION_CONFLICT',
      });
    },
  );

  acceptanceIt('AC35', 'stores no second case or event when a second one is refused', async () => {
    const { revisionId } = await openCase(app);

    await createCase(app, planReviewBody(revisionId, 'A second question.'));

    expect(world.cases).toHaveLength(1);
    expect(world.caseEvents).toHaveLength(1);
  });

  acceptanceIt('AC35', 'writes only the case and its CREATE event', async () => {
    const { revisionId } = await saveRevision(app);
    const before = structuredClone({
      plans: world.plans,
      planRevisions: world.planRevisions,
      studentSnapshots: world.studentSnapshots,
      audits: world.audits,
      attempts: world.attempts,
      sectionSnapshots: world.sectionSnapshots,
    });

    await createCase(app, planReviewBody(revisionId));

    expect({
      plans: world.plans,
      planRevisions: world.planRevisions,
      studentSnapshots: world.studentSnapshots,
      audits: world.audits,
      attempts: world.attempts,
      sectionSnapshots: world.sectionSnapshots,
    }).toEqual(before);
    expect(world.cases).toHaveLength(1);
    expect(world.caseEvents).toHaveLength(1);
  });
});
