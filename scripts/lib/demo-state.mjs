/**
 * @file Prepares the demo's dynamic state through the public API only: a saved plan that is then
 * made stale, and two open cases for the advisor queue. Nothing here touches a table; the API
 * client and the source-revision command are injected, so the steps run against fakes in tests.
 * @module scripts/lib/demo-state
 * @requirement FR-11
 * @requirement FR-12
 * @see docs/adr/0016-browser-end-to-end-tests-and-local-demo.md
 */
import { DEMO_PERSONAS } from './demo.mjs';

/** Code of the term the seeded sections and scenarios plan for. */
export const PLANNING_TERM_CODE = '2027SP';

/** DEMO-IND 390, the variable-credit course; the request picks 2.00 credits for it. */
export const IND_390_COURSE_ID = '50000000-0000-4000-8000-000000000390';

/** Credits picked for DEMO-IND 390, in hundredths. */
export const IND_390_CREDITS_HUNDREDTHS = 200;

/**
 * DEMO-MATH 102, DEMO-ENGL 101, DEMO-PHYS 301 (4.00, lab included) and DEMO-IND 390 (2.00): 12.00
 * credits, the seed policy's term minimum. Each has seeded sections.
 */
export const STALE_PLAN_COURSE_IDS = Object.freeze([
  '50000000-0000-4000-8000-000000000102',
  '50000000-0000-4000-8000-000000001101',
  '50000000-0000-4000-8000-000000000301',
  IND_390_COURSE_ID,
]);

const PLAN_REVIEW_NOTE = 'Please check my plan before I register.';
const DISCREPANCY_NOTE = 'My MATH 101 grade looks wrong to me.';

/**
 * Finds a persona by its source student ID.
 *
 * @param {string} sourceStudentId - For example `SYN-000006`.
 * @returns {(typeof DEMO_PERSONAS)[number]} The persona.
 * @throws {Error} When no persona has that ID.
 */
export function personaBySource(sourceStudentId) {
  const persona = DEMO_PERSONAS.find((candidate) => candidate.sourceStudentId === sourceStudentId);
  if (persona === undefined) {
    throw new Error(`No demo persona has source ID ${sourceStudentId}`);
  }
  return persona;
}

/**
 * Picks the planning term from the plannable terms.
 *
 * @param {{ terms: readonly { id: string, termCode: string }[] }} response - Plannable terms.
 * @returns {string} The term ID.
 * @throws {Error} When the planning term is not plannable (the seed did not load sections).
 */
export function pickPlanningTermId(response) {
  const term = response.terms.find((candidate) => candidate.termCode === PLANNING_TERM_CODE);
  if (term === undefined) {
    throw new Error(`Term ${PLANNING_TERM_CODE} is not plannable; was the demo seed loaded?`);
  }
  return term.id;
}

/**
 * Builds the schedule-options request for the stale persona.
 *
 * @param {string} termId - The planning term.
 * @returns {object} The request body.
 */
export function buildScheduleRequest(termId) {
  return {
    termId,
    courseIds: STALE_PLAN_COURSE_IDS,
    creditSelections: [
      { courseId: IND_390_COURSE_ID, selectedCreditsHundredths: IND_390_CREDITS_HUNDREDTHS },
    ],
    constraints: [],
  };
}

/**
 * Chooses the first ranked option and lists its section IDs.
 *
 * @param {{ outcome: string, options: readonly { bundles: readonly { sections: readonly { sectionId: string }[] }[] }[] }} response
 *   The schedule-options response.
 * @returns {string[]} Distinct section IDs, sorted.
 * @throws {Error} When the API found no option to save.
 */
export function pickFirstOptionSections(response) {
  const first = response.options[0];
  if (response.outcome !== 'OPTIONS_FOUND' || first === undefined) {
    throw new Error(`Schedule options came back ${response.outcome}; there is no plan to save`);
  }
  const ids = first.bundles.flatMap((bundle) =>
    bundle.sections.map((section) => section.sectionId),
  );
  return [...new Set(ids)].sort();
}

/**
 * Builds the body that saves a plan from what the student was shown.
 *
 * @param {object} request - The schedule-options request.
 * @param {{ pinnedInputs: unknown }} shown - The schedule-options response.
 * @param {string[]} sectionIds - The chosen sections.
 * @returns {object} The save body.
 */
export function buildSaveBody(request, shown, sectionIds) {
  return { request, selectedSectionIds: sectionIds, expectedPinnedInputs: shown.pinnedInputs };
}

/**
 * Builds a plan-review case body pinned to one revision.
 *
 * @param {string} planRevisionId - The revision to freeze into the case.
 * @returns {object} The case body.
 */
export function buildPlanReviewBody(planRevisionId) {
  return {
    reason: 'PLAN_REVIEW',
    planRevisionId,
    discrepancySubject: null,
    studentNote: PLAN_REVIEW_NOTE,
  };
}

/**
 * Builds a source-discrepancy case body, which needs no saved plan.
 *
 * @returns {object} The case body.
 */
export function buildDiscrepancyBody() {
  return {
    reason: 'SOURCE_DISCREPANCY',
    planRevisionId: null,
    discrepancySubject: 'COURSE_ATTEMPT',
    studentNote: DISCREPANCY_NOTE,
  };
}

/**
 * Prepares the dynamic demo state, in order: save a plan for the stale persona, publish a newer
 * source revision for it, open a plan-review case pinned to the stale revision, then open a
 * discrepancy case for the blocked persona.
 *
 * @param {object} deps - Injected collaborators.
 * @param {(token: string, name: string, options?: object) => Promise<any>} deps.call - Calls a
 *   named API endpoint as the holder of a dev token, through the typed client.
 * @param {(sourceStudentId: string) => Promise<void>} deps.revise - Publishes a newer source
 *   revision for one persona (`db:seed:revise --student`).
 * @param {(message: string) => void} deps.log - Reports progress.
 * @returns {Promise<{ cases: number, planId: string, staleRevisionId: string }>} What was created.
 * @throws {Error} When a step fails or the case does not read STALE.
 */
export async function prepareDemoState({ call, revise, log }) {
  const stale = personaBySource('SYN-000006');
  const blocked = personaBySource('SYN-000004');
  const advisor = DEMO_PERSONAS.find((persona) => persona.token === 'dev-token-advisor');
  const params = { studentId: stale.studentId };

  const terms = await call(stale.token, 'getPlannableTerms', { params });
  const request = buildScheduleRequest(pickPlanningTermId(terms));
  const shown = await call(stale.token, 'findScheduleOptions', { params, body: request });
  const sectionIds = pickFirstOptionSections(shown);
  const plan = await call(stale.token, 'savePlan', {
    params,
    body: buildSaveBody(request, shown, sectionIds),
  });
  log(`Saved a plan for ${stale.subject}`);

  await revise(stale.sourceStudentId);
  log(`Published a newer source revision for ${stale.sourceStudentId}`);

  const created = await call(stale.token, 'createCase', {
    params,
    body: buildPlanReviewBody(plan.latest.id),
  });
  if (created.context?.freshness?.state !== 'STALE') {
    throw new Error('The plan-review case did not read STALE after the source revision');
  }
  log('Opened a plan-review case on the stale revision');

  await call(blocked.token, 'createCase', {
    params: { studentId: blocked.studentId },
    body: buildDiscrepancyBody(),
  });
  log(`Opened a source-discrepancy case for ${blocked.subject}`);

  const queue = await call(advisor.token, 'listAdvisorCases');
  return { cases: queue.cases.length, planId: plan.id, staleRevisionId: plan.latest.id };
}
