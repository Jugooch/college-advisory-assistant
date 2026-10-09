/**
 * @file Acceptance AC51 (planning/13, ADR-0016 §4): the demo personas loaded from the demo seed
 * stay in the situation the walkthrough shows. The on-track student has nothing blocking next
 * term; the student missing a prerequisite gets FAIL `MIN_GRADE_NOT_MET` for DEMO-MATH 102; the
 * student with a pending transfer gets UNKNOWN `PENDING_TRANSFER`, never PASS; a saved plan reads
 * STALE once a newer record is published; and only the assigned advisor can open the personas.
 * The seed plan is the input. The expected states are stated literally from planning/08 and the
 * README scenarios (a D is below the required C; a pending transfer is UNKNOWN), never read from
 * the seed or the engine. Four cases are known findings (#609, #610) until the demo seed and the
 * schedule conflict set are fixed.
 * @requirement FR-01
 * @requirement FR-11
 * @requirement NFR-05
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/adr/0016-browser-end-to-end-tests-and-local-demo.md
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { type AcceptanceResponse, getAs, postAs, summarizeError } from '../support/api-harness';
import {
  buildDemoApp,
  createDemoWorld,
  DEMO_STUDENT_IDS,
  type DemoActor,
  type DemoPersona,
  reviseDemoRecord,
} from '../support/demo-world';
import { acceptanceIt } from '../support/known-findings-declarations';
import { dataOf, latestFreshness, saveBody } from '../support/plan-drafts-harness';

/** DEMO-MATH 102 (needs DEMO-MATH 101 with at least a C). */
const MATH_102 = '50000000-0000-4000-8000-000000000102';
/** DEMO-ENGL 101 (no prerequisite). */
const ENGL_101 = '50000000-0000-4000-8000-000000001101';
/** DEMO-PHYS 301 (4.00; needs DEMO-PHYS 201 with at least a C). */
const PHYS_301 = '50000000-0000-4000-8000-000000000301';
/** DEMO-IND 390 (variable, 1.00 to 3.00 credits). */
const IND_390 = '50000000-0000-4000-8000-000000000390';
/** The 2027SP term the demo plans. */
const TERM_2027SP = 'b0000000-0000-4000-8000-000000000004';

const world = createDemoWorld();

// NOTE: built once at module scope so Fastify's first build doesn't count against a case's timeout.
const app = buildDemoApp(world);

/**
 * Reads a student's academic summary.
 *
 * @param student - Whose record.
 * @param actor - Who signs in; the student themself by default.
 * @returns The response.
 */
function readSummary(
  student: DemoPersona,
  actor: DemoActor = student,
): Promise<AcceptanceResponse> {
  return getAs(
    app,
    `/v1/students/${DEMO_STUDENT_IDS[student]}/academic-summary`,
    `Bearer demo-${actor}`,
  );
}

/**
 * Checks DEMO-MATH 102 for a student.
 *
 * @param student - Whose record, signed in as themself.
 * @returns The response.
 */
function checkMath102(student: DemoPersona): Promise<AcceptanceResponse> {
  return postAs(app, {
    url: `/v1/students/${DEMO_STUDENT_IDS[student]}/course-checks`,
    authorization: `Bearer demo-${student}`,
    payload: { courseIds: [MATH_102] },
  });
}

describe('AC51 the demo personas show their situations', () => {
  beforeEach(() => {
    const fresh = createDemoWorld();
    Object.assign(world, fresh);
  });

  it('shows the on-track student a PASS audit and no requirement NOT_MET or UNKNOWN', async () => {
    const summary = await readSummary('onTrack');

    expect(summary.statusCode).toBe(200);
    expect(summary.body).toMatchObject({
      data: {
        auditReflectsRecord: { state: 'PASS' },
        programCatalogConsistency: { state: 'PASS' },
      },
    });
    const states = (dataOf(summary).requirements as { state: string }[]).map((item) => item.state);
    expect(states.length).toBeGreaterThan(0);
    expect(states).not.toContain('AMBIGUOUS');
    expect(
      states.filter((state) => !['COMPLETE', 'IN_PROGRESS', 'INCOMPLETE'].includes(state)),
    ).toEqual([]);
  });

  it('passes the on-track student through DEMO-MATH 102 with both checks PASS', async () => {
    const response = await checkMath102('onTrack');

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        courseResults: [
          {
            courseId: MATH_102,
            prerequisite: { state: 'PASS' },
            applicability: { state: 'PASS' },
          },
        ],
      },
    });
  });

  acceptanceIt(
    'AC51',
    'blocks the student missing a prerequisite with FAIL MIN_GRADE_NOT_MET, never UNKNOWN or PASS',
    async () => {
      const response = await checkMath102('blockedPrerequisite');

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        data: {
          courseResults: [
            {
              courseId: MATH_102,
              prerequisite: { state: 'FAIL', reasonCode: 'MIN_GRADE_NOT_MET' },
            },
          ],
          aggregate: 'BLOCKED',
        },
      });
    },
  );

  acceptanceIt(
    'AC51',
    'leaves the pending transfer UNKNOWN with PENDING_TRANSFER, never PASS',
    async () => {
      const response = await checkMath102('unknownData');

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        data: {
          courseResults: [
            {
              courseId: MATH_102,
              prerequisite: { state: 'UNKNOWN', reasonCode: 'PENDING_TRANSFER' },
            },
          ],
        },
      });
      expect(dataOf(response).aggregate).not.toBe('VALIDATED');
    },
  );

  acceptanceIt(
    'AC51',
    'reads the saved plan STALE with STUDENT_RECORD_SUPERSEDED after a newer record',
    async () => {
      const student = DEMO_STUDENT_IDS.stalePlan;
      // NOTE: 3.00 + 3.00 + 4.00 + 2.00 = 12.00, the seed policy's minimum credit load (README
      // scenario 3), so a plan can be saved. It needs the persona's record to hold DEMO-PHYS 201.
      const request = {
        termId: TERM_2027SP,
        courseIds: [MATH_102, ENGL_101, PHYS_301, IND_390],
        creditSelections: [{ courseId: IND_390, selectedCreditsHundredths: 200 }],
        constraints: [],
      };
      const authorization = 'Bearer demo-stalePlan';
      const shown = await postAs(app, {
        url: `/v1/students/${student}/schedule-options`,
        authorization,
        payload: request,
      });
      expect(dataOf(shown).outcome).toBe('OPTIONS_FOUND');
      const sections = (
        dataOf(shown).options as { bundles: { sections: { sectionId: string }[] }[] }[]
      )[0]?.bundles.flatMap((bundle) => bundle.sections.map((section) => section.sectionId));
      const saved = await postAs(app, {
        url: `/v1/students/${student}/plans`,
        authorization,
        payload: saveBody(shown, sections ?? [], request),
      });
      expect(saved.statusCode).toBeLessThan(300);
      const planUrl = `/v1/students/${student}/plans/${String(dataOf(saved).id)}`;
      expect(latestFreshness(await getAs(app, planUrl, authorization))).toMatchObject({
        state: 'CURRENT',
      });

      reviseDemoRecord(world, 'stalePlan');

      expect(latestFreshness(await getAs(app, planUrl, authorization))).toMatchObject({
        state: 'STALE',
        reasons: ['STUDENT_RECORD_SUPERSEDED'],
      });
    },
  );

  acceptanceIt(
    'AC51',
    'tells a student who asks for fewer credits than the minimum NO_FEASIBLE_PLAN, not an error',
    async () => {
      const response = await postAs(app, {
        url: `/v1/students/${DEMO_STUDENT_IDS.onTrack}/schedule-options`,
        authorization: 'Bearer demo-onTrack',
        payload: {
          termId: TERM_2027SP,
          courseIds: [MATH_102, ENGL_101],
          creditSelections: [],
          constraints: [],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        data: {
          outcome: 'NO_FEASIBLE_PLAN',
          conflictSet: {
            items: [{ kind: 'CREDIT_LOAD', state: 'FAIL', reasonCode: 'CREDIT_BELOW_MINIMUM' }],
          },
        },
      });
    },
  );

  it('lets the assigned advisor open every persona', async () => {
    for (const persona of ['onTrack', 'blockedPrerequisite', 'unknownData', 'stalePlan'] as const) {
      const summary = await readSummary(persona, 'advisor');

      expect(summary.statusCode).toBe(200);
      expect(summary.body).toMatchObject({ data: { student: { id: DEMO_STUDENT_IDS[persona] } } });
    }
  });

  it('answers another advisor as it answers for a student that does not exist', async () => {
    const missing = await getAs(
      app,
      '/v1/students/30000000-0000-4000-8000-0000000003e7/academic-summary',
      'Bearer demo-otherAdvisor',
    );

    for (const persona of ['onTrack', 'blockedPrerequisite', 'unknownData', 'stalePlan'] as const) {
      const refused = await readSummary(persona, 'otherAdvisor');

      expect(summarizeError(refused)).toEqual(summarizeError(missing));
    }
    expect(summarizeError(missing)).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });
});
