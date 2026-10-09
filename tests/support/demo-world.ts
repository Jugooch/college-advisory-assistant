/**
 * @file Loads the demo seed plan (`buildDemoSeedPlan`, #581) into the acceptance harness's
 * in-memory world, so AC51 can read the demo personas through the real API. Only the seed's source
 * records, identities and assignments are loaded; the API computes every state a persona shows.
 * @module @caa/tests/support/demo-world
 * @requirement FR-01
 * @requirement FR-11
 * @see docs/adr/0016-browser-end-to-end-tests-and-local-demo.md
 * @see docs/standards/07-testing.md
 */
import { buildDemoSeedPlan } from '@caa/db/testing';
import {
  createAdvisorAssignment,
  createStudent,
  createUserIdentity,
  type StudentSnapshot,
} from '@caa/domain';
import { buildStudentSnapshot } from '@caa/test-kit';

import {
  type AcceptanceApp,
  type AcceptanceOptions,
  type AcceptanceToken,
  type AcceptanceWorld,
  buildAcceptanceApp,
} from './api-harness';

/** The instant the demo seed run starts: eight hours before the harness clock (12:00Z). */
export const DEMO_SEED_RUN_AT = new Date('2026-09-01T08:00:00.000Z');

/** A time after the personas' records and before the harness clock, for a newer revision. */
export const DEMO_REVISION_AT = '2026-09-01T11:00:00.000Z';

/** Student IDs of the personas the demo walkthrough names, by source student ID. */
export const DEMO_STUDENT_IDS = {
  onTrack: '30000000-0000-4000-8000-000000000001',
  blockedPrerequisite: '30000000-0000-4000-8000-000000000004',
  unknownData: '30000000-0000-4000-8000-000000000005',
  stalePlan: '30000000-0000-4000-8000-000000000006',
} as const;

/** Key of one of {@link DEMO_STUDENT_IDS}. */
export type DemoPersona = keyof typeof DEMO_STUDENT_IDS;

/** Dev token of the signed-in persona or advisor. */
export type DemoActor = DemoPersona | 'advisor' | 'otherAdvisor';

/** Seed identity subject of each actor, as the demo's dev tokens sign in. */
const SUBJECTS: Readonly<Record<DemoActor, string>> = {
  onTrack: 'synthetic-student-001',
  blockedPrerequisite: 'synthetic-student-004',
  unknownData: 'synthetic-student-005',
  stalePlan: 'synthetic-student-006',
  advisor: 'synthetic-advisor-001',
  otherAdvisor: 'synthetic-advisor-002',
};

/**
 * Loads the demo seed plan into a new world.
 *
 * @returns The world, with the seed's identities, students, assignments, catalog, rules, policy,
 *   terms, records, audits, campuses and sections, and no plans.
 */
export function createDemoWorld(): AcceptanceWorld {
  const plan = buildDemoSeedPlan(DEMO_SEED_RUN_AT);
  const identities = plan.identities.map((item) => createUserIdentity(item));
  const identityBySubject = (subject: string) => {
    const found = identities.find((item) => item.subject === subject);
    if (found === undefined) throw new Error(`The demo seed has no identity ${subject}.`);
    return found;
  };
  const students = plan.students.map(({ userSubject, sourceStudentId, id, tenantId }) =>
    createStudent({
      id,
      tenantId,
      sourceStudentId,
      userId: userSubject === null ? null : identityBySubject(userSubject).id,
    }),
  );
  const studentBySource = (sourceStudentId: string) => {
    const found = students.find((item) => item.sourceStudentId === sourceStudentId);
    if (found === undefined) throw new Error(`The demo seed has no student ${sourceStudentId}.`);
    return found;
  };
  return {
    identities,
    students,
    assignments: plan.assignments.map((item) =>
      createAdvisorAssignment({
        id: item.id,
        tenantId: item.tenantId,
        advisorUserId: identityBySubject(item.advisorSubject).id,
        studentId: studentBySource(item.sourceStudentId).id,
        effectiveFrom: item.effectiveFrom,
        effectiveTo: item.effectiveTo,
        approvedBy: identityBySubject(item.approverSubject).id,
      }),
    ),
    programs: plan.academic.programs,
    courses: plan.academic.courses,
    rules: plan.academic.rules,
    policies: [plan.academic.policy],
    terms: plan.academic.terms,
    attempts: plan.academic.attempts,
    studentSnapshots: plan.academic.snapshots,
    audits: plan.academic.audits,
    campuses: plan.sections.campuses,
    campusTransitionPolicies: [plan.sections.transitionPolicy],
    sectionSnapshots: [plan.sections.snapshot],
    plans: [],
    planRevisions: [],
  };
}

/**
 * Builds the API over the world, accepting a token for each demo actor.
 *
 * @param world - The demo world.
 * @param options - Settings a case varies; none by default.
 * @returns The app.
 */
export function buildDemoApp(
  world: AcceptanceWorld,
  options: AcceptanceOptions = {},
): AcceptanceApp {
  const tokens: AcceptanceToken[] = Object.entries(SUBJECTS).map(([actor, subject]) => {
    const identity = world.identities.find((item) => item.subject === subject);
    if (identity === undefined) throw new Error(`The demo world has no identity ${subject}.`);
    return { token: `demo-${actor}`, identity };
  });
  return buildAcceptanceApp(world, tokens, options);
}

/**
 * Publishes a newer record of a persona's student, as `db:seed:revise --student` does: the same
 * attempts, a source time later than the pinned record.
 *
 * @param world - The demo world.
 * @param persona - Whose record is revised.
 */
export function reviseDemoRecord(world: AcceptanceWorld, persona: DemoPersona): void {
  const studentId = DEMO_STUDENT_IDS[persona];
  const current = (world.studentSnapshots ?? []).find((item) => item.studentId === studentId);
  if (current === undefined) throw new Error(`The demo world has no record of ${persona}.`);
  const revised: StudentSnapshot = buildStudentSnapshot(
    {
      studentId,
      tenantId: current.tenantId,
      programId: current.programId,
      catalogYear: current.catalogYear,
      attemptIds: current.attemptIds,
      sourceEffectiveAt: DEMO_REVISION_AT,
      ingestedAt: DEMO_REVISION_AT,
    },
    90,
  );
  world.studentSnapshots = [...(world.studentSnapshots ?? []), revised];
}
