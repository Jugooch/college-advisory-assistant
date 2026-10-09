/**
 * @file Acceptance AC34 (planning/13, ADR-0013 §4): the student revalidates a draft through
 * `POST /v1/students/:studentId/plans/:planId/revalidate`. A new revision is appended and earlier
 * ones are unchanged; a selection carries over only if the identical section set is still
 * offered, otherwise it is null; two racing revalidations give one 201 and one 409
 * REVISION_CONFLICT; stale current sources give 409 STALE_SOURCE with nothing written; only the
 * owning student may revalidate (everyone else gets 404); no response claims registration.
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import { summarizeError } from '../support/api-harness';
import { acceptanceIt } from '../support/known-findings-declarations';
import {
  dataOf,
  DEFAULT_OPTION_SECTIONS,
  keysAndStrings,
  MATH_ALT,
  MATH_MWF,
  PHYS_TTH,
  readPlanAt,
  resetPlanWorld,
  revalidatePlan,
  saveBody,
  savePlan,
  supersedeSections,
  viewDefaultOptions,
} from '../support/plan-drafts-harness';
import { publishSections } from '../support/schedule-options-harness';

const world = createAcademicWorld();

// NOTE: built once at module scope so Fastify's first build doesn't count against a case's
// timeout.
const app = buildAcademicApp(world);

/**
 * Saves the default option (MATH_MWF with PHYS_TTH) as revision 1 and returns the plan ID.
 *
 * @returns The plan ID.
 */
async function savedPlanId(): Promise<string> {
  const shown = await viewDefaultOptions(app);
  const saved = await savePlan(app, saveBody(shown, DEFAULT_OPTION_SECTIONS));
  expect(saved.statusCode).toBeLessThan(300);
  return String(dataOf(saved).id);
}

describe('AC34 plan draft revalidation appends a revision', () => {
  beforeEach(() => {
    resetPlanWorld(world);
  });

  acceptanceIt(
    'AC34',
    'returns 201 with revision 2 caused by REVALIDATED after a source is superseded',
    async () => {
      const planId = await savedPlanId();
      supersedeSections(world);

      const response = await revalidatePlan(app, { planId, expectedRevision: 1 });

      expect(response.statusCode).toBe(201);
      expect(dataOf(response)).toMatchObject({
        id: planId,
        revisions: [
          { revision: 1, cause: 'SAVED' },
          { revision: 2, cause: 'REVALIDATED' },
        ],
        latest: { revision: 2, cause: 'REVALIDATED', outcome: 'OPTIONS_FOUND' },
      });
      expect(world.planRevisions).toHaveLength(2);
    },
  );

  acceptanceIt('AC34', 'leaves revision 1 unchanged after revalidating', async () => {
    const planId = await savedPlanId();
    const before = await readPlanAt(app, `/${planId}/revisions/1`);
    supersedeSections(world);

    await revalidatePlan(app, { planId, expectedRevision: 1 });
    const after = await readPlanAt(app, `/${planId}/revisions/1`);

    expect(after.statusCode).toBe(200);
    expect(dataOf(after).revision).toBe(1);
    expect(dataOf(after).cause).toBe('SAVED');
    expect(dataOf(after).createdAt).toEqual(dataOf(before).createdAt);
    expect(dataOf(after).selectedSectionIds).toEqual(DEFAULT_OPTION_SECTIONS);
    expect(dataOf(after).result).toEqual(dataOf(before).result);
  });

  acceptanceIt(
    'AC34',
    'carries the selection over when the identical section set is still offered',
    async () => {
      const planId = await savedPlanId();
      supersedeSections(world);

      const response = await revalidatePlan(app, { planId, expectedRevision: 1 });

      expect(dataOf(response).latest).toMatchObject({
        selectedSectionIds: DEFAULT_OPTION_SECTIONS,
      });
    },
  );

  acceptanceIt(
    'AC34',
    'gives a null selection with outcome OPTIONS_FOUND when the selected section is withdrawn',
    async () => {
      publishSections(world, [MATH_MWF, MATH_ALT, PHYS_TTH]);
      const planId = await savedPlanId();
      publishSections(world, [MATH_ALT, PHYS_TTH], {
        sourceEffectiveAt: '2026-09-01T08:00:00.000Z',
      });

      const response = await revalidatePlan(app, { planId, expectedRevision: 1 });

      expect(response.statusCode).toBe(201);
      expect(dataOf(response).latest).toMatchObject({
        revision: 2,
        outcome: 'OPTIONS_FOUND',
        selectedSectionIds: null,
      });
    },
  );

  acceptanceIt(
    'AC34',
    'never substitutes a different section when the selected one is withdrawn',
    async () => {
      publishSections(world, [MATH_MWF, MATH_ALT, PHYS_TTH]);
      const planId = await savedPlanId();
      publishSections(world, [MATH_ALT, PHYS_TTH], {
        sourceEffectiveAt: '2026-09-01T08:00:00.000Z',
      });

      const response = await revalidatePlan(app, { planId, expectedRevision: 1 });

      const latest = dataOf(response).latest as { selectedSectionIds: unknown };
      expect(latest.selectedSectionIds).toBeNull();
      expect(JSON.stringify(latest.selectedSectionIds)).not.toContain(MATH_ALT.id);
    },
  );

  acceptanceIt(
    'AC34',
    'gives one 201 and one 409 REVISION_CONFLICT for two concurrent revalidations',
    async () => {
      const planId = await savedPlanId();

      const responses = await Promise.all([
        revalidatePlan(app, { planId, expectedRevision: 1 }),
        revalidatePlan(app, { planId, expectedRevision: 1 }),
      ]);

      expect(responses.map(({ statusCode }) => statusCode).sort()).toEqual([201, 409]);
      const refused = responses.find(({ statusCode }) => statusCode === 409);
      expect(refused === undefined ? undefined : summarizeError(refused)).toMatchObject({
        bodyKeys: ['error'],
        code: 'REVISION_CONFLICT',
      });
      expect(world.planRevisions).toHaveLength(2);
    },
  );

  acceptanceIt(
    'AC34',
    'gives 409 STALE_SOURCE and writes nothing when the current sources are stale',
    async () => {
      const planId = await savedPlanId();
      publishSections(world, [MATH_MWF, PHYS_TTH], {
        sourceEffectiveAt: '2026-08-01T00:00:00.000Z',
      });

      const response = await revalidatePlan(app, { planId, expectedRevision: 1 });

      expect(summarizeError(response)).toMatchObject({
        statusCode: 409,
        bodyKeys: ['error'],
        code: 'STALE_SOURCE',
      });
      expect(world.planRevisions).toHaveLength(1);
    },
  );

  acceptanceIt(
    'AC34',
    'gives an assigned advisor, another student and another tenant 404 and writes nothing',
    async () => {
      const planId = await savedPlanId();
      supersedeSections(world);

      const refused = await Promise.all(
        (['advisor', 'otherStudent', 'tenantBAdmin'] as const).map((actor) =>
          revalidatePlan(app, { planId, expectedRevision: 1 }, { actor }),
        ),
      );

      expect(refused.map(summarizeError)).toMatchObject(
        refused.map(() => ({ statusCode: 404, bodyKeys: ['error'], code: 'NOT_FOUND' })),
      );
      expect(world.planRevisions).toHaveLength(1);
    },
  );

  acceptanceIt(
    'AC34',
    'says registered, enrolled or approved in no field or value of the revalidate response',
    async () => {
      const planId = await savedPlanId();
      supersedeSections(world);

      const response = await revalidatePlan(app, { planId, expectedRevision: 1 });

      expect(response.statusCode).toBe(201);
      const { keys, strings } = keysAndStrings(response.body);
      const found = [...keys, ...strings].filter(
        (text) =>
          /regist|enroll|approv/i.test(text) &&
          !['NOT_REGISTERED', 'REGISTRATION_READINESS_NOT_CHECKED'].includes(text),
      );
      expect(found).toEqual([]);
    },
  );
});
