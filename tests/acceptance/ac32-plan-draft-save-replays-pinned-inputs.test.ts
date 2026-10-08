/**
 * @file Acceptance AC32 (planning/13, ADR-0013 §1-2, §5): saving a schedule option, or a result
 * with no options, as a plan draft through `POST /v1/students/:studentId/plans`. The stored
 * revision is the server's replay on the pinned inputs, never client evidence. Changed inputs give
 * 409 with nothing written; only the student saves, and everyone else gets 404; a body naming a
 * tenant, user, role or owner is 400.
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { SYNTHETIC_COURSES } from '@caa/test-kit';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import { summarizeError } from '../support/api-harness';
import { acceptanceIt } from '../support/known-findings';
import {
  dataOf,
  DEFAULT_OPTION_SECTIONS,
  expectSaved,
  MATH_MWF,
  resetPlanWorld,
  saveBody,
  savePlan,
  supersedeSections,
  viewDefaultOptions,
} from '../support/plan-drafts-harness';
import { publishSections } from '../support/schedule-options-harness';

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const app = buildAcademicApp(world);

/** Asserts that no plan and no revision was stored. */
function expectNothingWritten(): void {
  expect(world.plans).toEqual([]);
  expect(world.planRevisions).toEqual([]);
}

describe('AC32 plan draft save replays the pinned inputs', () => {
  beforeEach(() => {
    resetPlanWorld(world);
  });

  acceptanceIt(
    'AC32',
    'saves an offered option as revision 1, cause SAVED, equal to what the student was shown',
    async () => {
      const shown = await viewDefaultOptions(app);

      const saved = await savePlan(app, saveBody(shown, DEFAULT_OPTION_SECTIONS));

      expectSaved(saved);
      expect(dataOf(saved)).toMatchObject({
        revisions: [{ revision: 1, cause: 'SAVED' }],
        latest: {
          revision: 1,
          cause: 'SAVED',
          outcome: 'OPTIONS_FOUND',
          selectedSectionIds: DEFAULT_OPTION_SECTIONS,
          resultUnavailable: false,
          result: dataOf(shown),
        },
      });
      expect(world.planRevisions).toHaveLength(1);
    },
  );

  acceptanceIt('AC32', 'returns 201 when an offered option is saved', async () => {
    const saved = await savePlan(
      app,
      saveBody(await viewDefaultOptions(app), DEFAULT_OPTION_SECTIONS),
    );

    expect(saved.statusCode).toBe(201);
  });

  acceptanceIt(
    'AC32',
    'saves a result with no options and a null chosen section set as revision 1',
    async () => {
      publishSections(world, [MATH_MWF]);
      const shown = await viewDefaultOptions(app);
      expect(dataOf(shown)).toMatchObject({ outcome: 'NEEDS_VERIFICATION', options: [] });

      const saved = await savePlan(app, saveBody(shown, null));

      expectSaved(saved);
      expect(dataOf(saved)).toMatchObject({
        latest: {
          revision: 1,
          cause: 'SAVED',
          outcome: 'NEEDS_VERIFICATION',
          selectedSectionIds: null,
        },
      });
    },
  );

  acceptanceIt('AC32', 'returns 201 when a result with no options is saved', async () => {
    publishSections(world, [MATH_MWF]);

    const saved = await savePlan(app, saveBody(await viewDefaultOptions(app), null));

    expect(saved.statusCode).toBe(201);
  });

  acceptanceIt(
    'AC32',
    'refuses a chosen section set that is not an offered option with 400 and writes nothing',
    async () => {
      const shown = await viewDefaultOptions(app);

      const refused = await savePlan(app, saveBody(shown, [MATH_MWF.id]));

      expect(summarizeError(refused)).toMatchObject({ statusCode: 400, code: 'INVALID_REQUEST' });
      expectNothingWritten();
    },
  );

  acceptanceIt(
    'AC32',
    'refuses a save after an input changed between viewing and saving with 409 REVISION_CONFLICT',
    async () => {
      const shown = await viewDefaultOptions(app);
      supersedeSections(world);

      const refused = await savePlan(app, saveBody(shown, DEFAULT_OPTION_SECTIONS));

      expect(summarizeError(refused)).toMatchObject({
        statusCode: 409,
        bodyKeys: ['error'],
        code: 'REVISION_CONFLICT',
      });
      expectNothingWritten();
    },
  );

  acceptanceIt(
    'AC32',
    'gives an assigned advisor, another student and another tenant 404 and writes nothing',
    async () => {
      const shown = await viewDefaultOptions(app);
      const body = saveBody(shown, DEFAULT_OPTION_SECTIONS);

      const refused = await Promise.all(
        (['advisor', 'otherStudent', 'tenantBAdmin'] as const).map((actor) =>
          savePlan(app, body, { actor }),
        ),
      );

      expect(refused.map(summarizeError)).toMatchObject(
        refused.map(() => ({ statusCode: 404, bodyKeys: ['error'], code: 'NOT_FOUND' })),
      );
      expectNothingWritten();
    },
  );

  acceptanceIt(
    'AC32',
    'refuses a body naming a tenant, user, role or owner with 400 and writes nothing',
    async () => {
      const shown = await viewDefaultOptions(app);
      const body = saveBody(shown, DEFAULT_OPTION_SECTIONS);
      const ownId = SYNTHETIC_COURSES.math102.id;
      const extras = [
        { tenantId: ownId },
        { userId: ownId },
        { role: 'ADVISOR' },
        { ownerUserId: ownId },
      ];

      const refused = await Promise.all(
        extras.map((extra) => savePlan(app, { ...body, ...extra })),
      );

      expect(refused.map(summarizeError)).toMatchObject(
        extras.map(() => ({ statusCode: 400, bodyKeys: ['error'], code: 'INVALID_REQUEST' })),
      );
      expectNothingWritten();
    },
  );

  acceptanceIt(
    'AC32',
    'refuses client-supplied result evidence with 400 and writes nothing',
    async () => {
      const shown = await viewDefaultOptions(app);
      const body = saveBody(shown, DEFAULT_OPTION_SECTIONS);

      const refused = await savePlan(app, { ...body, result: dataOf(shown) });

      expect(summarizeError(refused)).toMatchObject({ statusCode: 400, code: 'INVALID_REQUEST' });
      expectNothingWritten();
    },
  );
});
