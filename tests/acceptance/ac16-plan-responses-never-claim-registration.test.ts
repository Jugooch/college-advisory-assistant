/**
 * @file Acceptance AC16 (planning/13): "register me" is answered with the saved-plan boundary. No
 * plan response field or value says registered, enrolled or approved, and no enrollment action
 * exists (FR-11). The save, read and list responses are covered; the revalidate response is
 * pending (#410).
 * @requirement FR-11
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { beforeEach, describe, expect } from 'vitest';

import {
  ACADEMIC_STUDENT_ID,
  buildAcademicApp,
  createAcademicWorld,
} from '../support/academic-endpoints-harness';
import { postAs } from '../support/api-harness';
import { acceptanceIt } from '../support/known-findings-declarations';
import {
  dataOf,
  expectSaved,
  keysAndStrings,
  listPlans,
  readPlanAt,
  resetPlanWorld,
  revalidatePlan,
  saveDefaultOption,
  supersedeSections,
} from '../support/plan-drafts-harness';

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const app = buildAcademicApp(world);

const CLAIM = /regist|enroll|approv/i;

/** The stored result's own disclaimers: each one says registration is NOT done or checked. */
const DISCLAIMERS = new Set(['NOT_REGISTERED', 'REGISTRATION_READINESS_NOT_CHECKED']);

describe('AC16 plan responses never claim registration', () => {
  beforeEach(() => {
    resetPlanWorld(world);
  });

  acceptanceIt(
    'AC16',
    'says registered, enrolled or approved in no field or value of a saved, read or listed plan',
    async () => {
      const saved = await saveDefaultOption(app);
      const planId = String(dataOf(saved).id);
      const responses = [
        saved,
        await readPlanAt(app, `/${planId}`),
        await readPlanAt(app, `/${planId}/revisions/1`),
        await listPlans(app),
      ];

      expectSaved(saved);
      expect(responses.slice(1).map(({ statusCode }) => statusCode)).toEqual([200, 200, 200]);
      const found = responses.flatMap(({ body }) => {
        const { keys, strings } = keysAndStrings(body);
        return [...keys, ...strings].filter((text) => CLAIM.test(text) && !DISCLAIMERS.has(text));
      });
      expect(found).toEqual([]);
    },
  );

  acceptanceIt('AC16', 'has no enrollment or registration action on a plan', async () => {
    const saved = await saveDefaultOption(app);
    const planId = String(dataOf(saved).id);

    const attempts = await Promise.all(
      ['register', 'enroll', 'approve'].map((action) =>
        postAs(app, {
          url: `/v1/students/${ACADEMIC_STUDENT_ID}/plans/${planId}/${action}`,
          authorization: 'Bearer academic-student',
          payload: {},
        }),
      ),
    );

    expect(attempts.map(({ statusCode }) => statusCode)).toEqual([404, 404, 404]);
  });

  acceptanceIt(
    'AC16',
    'says registered, enrolled or approved in no field or value of a revalidate response',
    async () => {
      const saved = await saveDefaultOption(app);
      const planId = String(dataOf(saved).id);
      supersedeSections(world);

      const revalidated = await revalidatePlan(app, { planId, expectedRevision: 1 });

      expect(revalidated.statusCode).toBe(201);
      const { keys, strings } = keysAndStrings(revalidated.body);
      const found = [...keys, ...strings].filter(
        (text) => CLAIM.test(text) && !DISCLAIMERS.has(text),
      );
      expect(found).toEqual([]);
    },
  );
});
