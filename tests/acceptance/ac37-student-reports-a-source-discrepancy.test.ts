/**
 * @file Acceptance AC37 (planning/13, ADR-0013 §6, FR-17): a student reports a discrepancy in a
 * course attempt. A SOURCE_DISCREPANCY case is created; the student snapshot, audit and attempts
 * are unchanged; nothing presents the report as a correction or waiver.
 * @requirement FR-12
 * @requirement FR-17
 * @requirement NFR-01
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { buildCourseAttempt } from '@caa/test-kit';

import {
  buildAcademicApp,
  createAcademicWorld,
  resetAcademicWorld,
} from '../support/academic-endpoints-harness';
import { summarizeError } from '../support/api-harness';
import {
  actOnCase,
  type CasesWorld,
  createCase,
  discrepancyBody,
  readCase,
  resetCasesWorld,
} from '../support/cases-harness';
import { acceptanceIt } from '../support/known-findings-declarations';
import { dataOf, keysAndStrings } from '../support/plan-drafts-harness';

const world: CasesWorld = createAcademicWorld();

// NOTE: built once at module scope so Fastify's first build doesn't count against a case's timeout.
const app = buildAcademicApp(world);

/** The 400 a malformed body gives. */
const INVALID = { statusCode: 400, bodyKeys: ['error'], code: 'INVALID_REQUEST' };

/** Everything the report must leave unchanged. */
function authoritativeRecords(): unknown {
  return structuredClone({
    studentSnapshots: world.studentSnapshots,
    audits: world.audits,
    attempts: world.attempts,
    courses: world.courses,
    rules: world.rules,
    plans: world.plans,
    planRevisions: world.planRevisions,
  });
}

describe('AC37 a student reports a source discrepancy', () => {
  beforeEach(() => {
    resetCasesWorld(world);
    resetAcademicWorld(world, { attempts: [buildCourseAttempt()] });
  });

  acceptanceIt(
    'AC37',
    'creates an OPEN SOURCE_DISCREPANCY case for a course attempt with no plan revision',
    async () => {
      const created = await createCase(app, discrepancyBody('COURSE_ATTEMPT'));

      expect(created.statusCode).toBe(201);
      expect(dataOf(created)).toMatchObject({
        reason: 'SOURCE_DISCREPANCY',
        discrepancySubject: 'COURSE_ATTEMPT',
        planRevisionId: null,
        context: null,
        status: 'OPEN',
        owner: null,
        allowedActions: ['WITHDRAW'],
      });
    },
  );

  acceptanceIt(
    'AC37',
    'leaves the student snapshot, audit, attempts and catalog unchanged',
    async () => {
      const before = authoritativeRecords();

      await createCase(app, discrepancyBody('COURSE_ATTEMPT'));

      expect(authoritativeRecords()).toEqual(before);
    },
  );

  acceptanceIt('AC37', 'stores exactly one case and its CREATE event', async () => {
    await createCase(app, discrepancyBody('COURSE_ATTEMPT'));

    expect(world.cases).toHaveLength(1);
    expect(world.caseEvents).toHaveLength(1);
  });

  acceptanceIt('AC37', 'does not present the report as a correction or a waiver', async () => {
    const created = await createCase(app, discrepancyBody('COURSE_ATTEMPT'));

    const { keys } = keysAndStrings(dataOf(created));
    expect(keys.filter((key) => /waiver|exception|correction|override/i.test(key))).toEqual([]);
  });

  acceptanceIt(
    'AC37',
    'offers nobody a way to approve the report as a change of record',
    async () => {
      const created = await createCase(app, discrepancyBody('COURSE_ATTEMPT'));

      const advisorRead = await readCase(app, String(dataOf(created).id), 'advisor');

      expect(dataOf(advisorRead).allowedActions).toEqual(['CLAIM']);
    },
  );

  describe.each(['PROGRAM_OR_CATALOG', 'AUDIT_REQUIREMENT', 'SECTION'] as const)(
    'subject %s',
    (subject) => {
      acceptanceIt(
        'AC37',
        `creates a case for subject ${subject} and changes no record`,
        async () => {
          const before = authoritativeRecords();

          const created = await createCase(app, discrepancyBody(subject));

          expect(created.statusCode).toBe(201);
          expect(dataOf(created)).toMatchObject({
            reason: 'SOURCE_DISCREPANCY',
            discrepancySubject: subject,
          });
          expect(authoritativeRecords()).toEqual(before);
        },
      );
    },
  );

  acceptanceIt('AC37', 'refuses a discrepancy without a subject with 400', async () => {
    const refused = await createCase(app, {
      ...discrepancyBody('COURSE_ATTEMPT'),
      discrepancySubject: null,
    });

    expect(summarizeError(refused)).toMatchObject(INVALID);
    expect(world.cases).toEqual([]);
  });

  acceptanceIt('AC37', 'refuses an unknown subject with 400', async () => {
    const refused = await createCase(app, discrepancyBody('GRADE'));

    expect(summarizeError(refused)).toMatchObject(INVALID);
    expect(world.cases).toEqual([]);
  });

  acceptanceIt(
    'AC37',
    'allows a second discrepancy case because none is tied to a plan',
    async () => {
      await createCase(app, discrepancyBody('COURSE_ATTEMPT'));

      const second = await createCase(
        app,
        discrepancyBody('SECTION', 'The section time looks wrong.'),
      );

      expect(second.statusCode).toBe(201);
    },
  );

  acceptanceIt('AC37', 'gives another student 404 for the discrepancy case', async () => {
    const created = await createCase(app, discrepancyBody('COURSE_ATTEMPT'));

    const read = await readCase(app, String(dataOf(created).id), 'otherStudent');

    expect(summarizeError(read)).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  describe('the advisor resolution', () => {
    acceptanceIt(
      'AC37',
      'changes no attempt, audit or snapshot and creates no waiver when resolved',
      async () => {
        const created = await createCase(app, discrepancyBody('COURSE_ATTEMPT'));
        const caseId = String(dataOf(created).id);
        await actOnCase(app, caseId, { action: 'CLAIM', expectedSequence: 1 });
        const before = authoritativeRecords();

        const resolved = await actOnCase(app, caseId, {
          action: 'RESOLVE',
          expectedSequence: 2,
          resolution: 'REFERRED_OUTSIDE_APP',
          note: 'Please ask the registrar about this grade.',
        });

        expect(resolved.statusCode).toBe(201);
        expect(dataOf(resolved)).toMatchObject({ status: 'RESOLVED', context: null });
        expect(authoritativeRecords()).toEqual(before);
      },
    );
  });
});
