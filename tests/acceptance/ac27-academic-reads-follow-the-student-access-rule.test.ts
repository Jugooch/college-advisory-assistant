/**
 * @file Acceptance: the academic summary and course checks follow the student access rule. The
 * student and an assigned advisor may read; an unassigned advisor, another student, and another
 * tenant get a 404 identical to a missing student. Identity comes only from the session, so a body
 * that names a tenant or role is rejected.
 * @requirement FR-01
 * @requirement FR-02
 * @requirement T01
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/standards/09-errors-logging-and-security.md
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { SYNTHETIC_COURSES, SYNTHETIC_TENANTS } from '@caa/test-kit';

import {
  type AcademicActor,
  buildAcademicApp,
  checkCourses,
  createAcademicWorld,
  MISSING_STUDENT_ID,
  readSummary,
  resetAcademicWorld,
} from '../support/academic-endpoints-harness';
import { getAs, postAs, summarizeError } from '../support/api-harness';

const MATH102_ONLY = { courseIds: [SYNTHETIC_COURSES.math102.id] };
const NOT_FOUND = {
  statusCode: 404,
  bodyKeys: ['error'],
  errorKeys: ['code', 'message', 'requestId'],
  code: 'NOT_FOUND',
};
const INVALID = { statusCode: 400, bodyKeys: ['error'], code: 'INVALID_REQUEST' };
const ALLOWED: readonly AcademicActor[] = ['student', 'advisor'];
const DENIED: readonly AcademicActor[] = ['unassignedAdvisor', 'otherStudent', 'tenantBAdmin'];

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const app = buildAcademicApp(world);

describe('AC27 academic reads follow the student access rule', () => {
  beforeEach(() => {
    resetAcademicWorld(world);
  });

  it.each(ALLOWED)('serves the academic summary to the %s', async (actor) => {
    const response = await readSummary(app, { actor });

    expect(response).toMatchObject({
      statusCode: 200,
      body: { data: { student: { id: '30000000-0000-4000-8000-000000000001' } } },
    });
  });

  it.each(ALLOWED)('runs course checks for the %s', async (actor) => {
    const response = await checkCourses(app, MATH102_ONLY, { actor });

    expect(response.statusCode).toBe(200);
  });

  it.each(DENIED)('answers the %s with 404 on the academic summary', async (actor) => {
    const response = await readSummary(app, { actor });

    expect(summarizeError(response)).toMatchObject(NOT_FOUND);
  });

  it.each(DENIED)('answers the %s with 404 on course checks', async (actor) => {
    const response = await checkCourses(app, MATH102_ONLY, { actor });

    expect(summarizeError(response)).toMatchObject(NOT_FOUND);
  });

  it.each(DENIED)(
    'answers the %s exactly as it would for a student that does not exist',
    async (actor) => {
      const deniedSummary = await readSummary(app, { actor });
      const missingSummary = await readSummary(app, { actor, studentId: MISSING_STUDENT_ID });
      const deniedChecks = await checkCourses(app, MATH102_ONLY, { actor });
      const missingChecks = await checkCourses(app, MATH102_ONLY, {
        actor,
        studentId: MISSING_STUDENT_ID,
      });

      expect(summarizeError(deniedSummary)).toEqual(summarizeError(missingSummary));
      expect(summarizeError(deniedChecks)).toEqual(summarizeError(missingChecks));
    },
  );

  it('never echoes the student, their record, or their audit to another tenant', async () => {
    const summary = await readSummary(app, { actor: 'tenantBAdmin' });
    const checks = await checkCourses(app, MATH102_ONLY, { actor: 'tenantBAdmin' });
    const text = JSON.stringify([summary.body, checks.body]);

    expect(text).not.toContain('30000000-0000-4000-8000-000000000001');
    expect(text).not.toContain('SYN-000001');
    expect(text).not.toContain('a0000000-0000-4000-8000-000000000001');
    expect(text).not.toContain('audit_demo_r1');
  });

  it.each([
    ['a tenant', { tenantId: SYNTHETIC_TENANTS.a.id }],
    ['a role', { role: 'ADMIN' }],
    ['a user', { userId: '20000000-0000-4000-8000-000000000002' }],
  ])('rejects a course-checks body that names %s with 400', async (_field, extra) => {
    const response = await checkCourses(app, { ...MATH102_ONLY, ...extra });

    expect(summarizeError(response)).toMatchObject(INVALID);
  });

  it('does not let a tenant in the body open another tenant’s student', async () => {
    const response = await checkCourses(
      app,
      { ...MATH102_ONLY, tenantId: SYNTHETIC_TENANTS.a.id },
      { actor: 'tenantBAdmin' },
    );

    expect(response.statusCode).not.toBe(200);
  });

  it('answers a missing session and an unknown one with 401', async () => {
    const summary = await getAs(
      app,
      '/v1/students/30000000-0000-4000-8000-000000000001/academic-summary',
      null,
    );
    const checks = await postAs(app, {
      url: '/v1/students/30000000-0000-4000-8000-000000000001/course-checks',
      authorization: 'Bearer not-a-known-token',
      payload: MATH102_ONLY,
    });

    expect(summarizeError(summary)).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
    expect(summarizeError(checks)).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });
});
