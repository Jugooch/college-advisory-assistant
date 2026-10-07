/**
 * @file Tests for the course checks service: access, session-scoped loading, missing inputs,
 * unknown courses, engine input errors, the active ruleset, and ID-only logging.
 * @requirement FR-02
 * @requirement FR-05
 * @requirement FR-10
 * @requirement NFR-04
 */
import { describe, expect, it } from 'vitest';

import { CheckState, type CourseId, ReasonCode } from '@caa/domain';
import { buildCourse, SYNTHETIC_TENANTS } from '@caa/test-kit';

import {
  InconsistentInputsError,
  InvalidRequestError,
  NotFoundError,
  RulesetNotConfiguredError,
  SourceUnavailableError,
  StaleSourceError,
} from '../../shared/domain-errors';
import {
  CHECK_ACTOR as actor,
  CHECK_STUDENT as student,
  runCourseChecks as check,
} from '../../testing/course-checks-harness';
import type { InMemoryAcademicStore } from '../../testing/in-memory-academic-repositories';
import { SEED_AUDITS, SEED_COURSES, SEED_SNAPSHOTS } from '../../testing/seed-scenario-fixtures';

const { math102, ind390, engl101 } = SEED_COURSES;

const MATH_102_QUERY = { courseIds: [SEED_COURSES.math102.id] };

describe('CourseChecksService.checkCourses', () => {
  it('returns every check dimension for each course and for the set', async () => {
    const checks = await check({ courseIds: [math102.id, engl101.id] }).result;

    expect(checks.courseResults.map((result) => result.courseId)).toEqual([math102.id, engl101.id]);
    expect(checks.courseResults[0]?.prerequisite?.kind).toBe('PREREQUISITE');
    expect(checks.courseResults.map((result) => result.applicability.kind)).toEqual([
      'REQUIREMENT_APPLICABILITY',
      'REQUIREMENT_APPLICABILITY',
    ]);
    expect(checks.setResults.allocation.map((result) => result.kind)).toEqual([
      'REQUIREMENT_ALLOCATION',
    ]);
    expect(checks.setResults.creditLoad.kind).toBe('CREDIT_LOAD');
  });

  it('looks rules up for the session tenant at the policy ruleset version', async () => {
    const { result, ruleLookups } = check({ courseIds: [math102.id] });

    await result;

    expect(ruleLookups).toEqual([[actor.tenantId, math102.id, 'demo-2026.1']]);
  });

  it('reports an unselected variable credit as UNKNOWN, never an assumed value', async () => {
    const checks = await check({ courseIds: [ind390.id] }).result;

    expect(checks.courses).toEqual([
      {
        courseId: ind390.id,
        code: 'DEMO-IND 390',
        title: null,
        credits: { kind: 'VARIABLE', minCreditsHundredths: 100, maxCreditsHundredths: 300 },
      },
    ]);
    expect(checks.setResults.creditLoad).toMatchObject({
      state: CheckState.Unknown,
      reasonCode: ReasonCode.VariableCreditUnselected,
    });
  });

  it('throws NOT_FOUND without loading anything when access is denied', async () => {
    const { result, ruleLookups, logger } = check(
      { courseIds: [math102.id] },
      { isAllowed: false },
    );

    await expect(result).rejects.toBeInstanceOf(NotFoundError);
    expect([ruleLookups, logger.entries]).toEqual([[], []]);
  });

  it('refers the student with SOURCE_UNAVAILABLE when there is no audit', async () => {
    const { result, logger } = check(
      { courseIds: [math102.id] },
      { change: (store) => ({ ...store, audits: [] }) },
    );

    await expect(result).rejects.toBeInstanceOf(SourceUnavailableError);
    expect(logger.entries).toEqual([
      {
        level: 'info',
        message: 'academic record unavailable',
        details: {
          actorUserId: actor.userId,
          tenantId: actor.tenantId,
          studentId: student.id,
          reason: 'NO_AUDIT',
        },
      },
    ]);
  });

  it('refers the student with SOURCE_UNAVAILABLE when the ruleset has no policy', async () => {
    const { result, logger } = check({ courseIds: [math102.id] }, { rulesetVersion: 'other-1' });

    await expect(result).rejects.toBeInstanceOf(SourceUnavailableError);
    expect(logger.entries[0]?.details).toMatchObject({ reason: 'NO_ACADEMIC_POLICY' });
  });

  it('fails closed when no active ruleset is configured', async () => {
    await expect(
      check({ courseIds: [math102.id] }, { rulesetVersion: null }).result,
    ).rejects.toBeInstanceOf(RulesetNotConfiguredError);
  });

  it('rejects a course outside the tenant catalog with INVALID_REQUEST, never a PASS', async () => {
    const unknown: CourseId = buildCourse({}, 0x999).id;

    const { result, logger } = check({ courseIds: [math102.id, unknown] });

    await expect(result).rejects.toBeInstanceOf(InvalidRequestError);
    expect(logger.entries[0]).toMatchObject({
      message: 'course checks rejected',
      details: { reason: 'COURSE_NOT_IN_CATALOG' },
    });
  });

  it('rejects a course of another tenant as outside the catalog', async () => {
    const foreign = buildCourse({ tenantId: SYNTHETIC_TENANTS.b.id }, 0x998);

    const { result } = check(
      { courseIds: [foreign.id] },
      { change: (store) => ({ ...store, courses: [...(store.courses ?? []), foreign] }) },
    );

    await expect(result).rejects.toBeInstanceOf(InvalidRequestError);
  });

  it('turns a request-caused engine input error into INVALID_REQUEST, logging its reason', async () => {
    const { result, logger } = check({
      courseIds: [ind390.id],
      creditSelections: [{ courseId: ind390.id, selectedCreditsHundredths: 900 }],
    });

    await expect(result).rejects.toBeInstanceOf(InvalidRequestError);
    expect(logger.entries[0]).toMatchObject({
      level: 'info',
      details: { reason: 'CandidateSetInputError:selectedCredits' },
    });
  });

  it('logs the run with opaque IDs, versions, and the aggregate only', async () => {
    const { result, logger } = check({ courseIds: [math102.id] });

    await result;

    expect(logger.entries).toEqual([
      {
        level: 'info',
        message: 'course checks run',
        details: {
          actorUserId: '20000000-0000-4000-8000-000000000001',
          tenantId: '10000000-0000-4000-8000-000000000001',
          studentId: '30000000-0000-4000-8000-000000000001',
          studentSnapshotId: SEED_SNAPSHOTS.current.id,
          studentRecordEffectiveAt: '2026-09-01T05:00:00.000Z',
          auditRecordEffectiveAt: '2026-09-01T05:00:00.000Z',
          auditSource: 'demo-audit',
          auditVersion: 'audit_demo_r1',
          rulesetVersion: 'demo-2026.1',
          courseCount: 1,
          // NOTE: 3.00 credits is below the 12.00 minimum, so credit load FAILs: BLOCKED.
          aggregate: 'BLOCKED',
        },
      },
    ]);
    expect(JSON.stringify(logger.entries)).not.toContain(student.sourceStudentId);
  });
});

describe('CourseChecksService.checkCourses stored-data engine errors', () => {
  const noRange = { ...ind390, minCreditsHundredths: null, maxCreditsHundredths: null };
  const withoutRange = (store: InMemoryAcademicStore) => ({
    ...store,
    courses: (store.courses ?? []).map((course) => (course.id === ind390.id ? noRange : course)),
  });
  const invertedBounds = (store: InMemoryAcademicStore) => ({
    ...store,
    policies: (store.policies ?? []).map((policy) => ({
      ...policy,
      termCreditBounds: { minCreditsHundredths: 1800, maxCreditsHundredths: 1200 },
    })),
  });

  it.each([
    {
      name: 'a course with no credit range',
      courseIds: [ind390.id],
      change: withoutRange,
      reason: 'CandidateSetInputError:courseCredits',
    },
    {
      name: 'inverted term credit bounds',
      courseIds: [math102.id],
      change: invertedBounds,
      reason: 'CandidateSetInputError:bounds',
    },
  ])(
    'refers the student with SOURCE_UNAVAILABLE for $name',
    async ({ courseIds, change, reason }) => {
      const { result, logger } = check({ courseIds }, { change });

      await expect(result).rejects.toBeInstanceOf(SourceUnavailableError);
      expect(logger.entries).toEqual([
        {
          level: 'warn',
          message: 'course checks input invalid',
          details: {
            actorUserId: actor.userId,
            tenantId: actor.tenantId,
            studentId: student.id,
            cause: 'STORED_DATA',
            reason,
          },
        },
      ]);
    },
  );

  it('fails with an internal error when a loaded rule is at another ruleset', async () => {
    const { result, logger } = check(MATH_102_QUERY, {
      mapRule: (rule) => ({ ...rule, rulesetVersion: 'other-1' }),
    });

    await expect(result).rejects.toBeInstanceOf(InconsistentInputsError);
    expect(logger.entries[0]).toMatchObject({
      level: 'warn',
      details: { cause: 'INTERNAL', reason: 'PrerequisiteInputMismatchError' },
    });
  });
});

describe('CourseChecksService.checkCourses source freshness', () => {
  it('accepts a record and audit exactly 24 hours old', async () => {
    const checks = await check(MATH_102_QUERY, { now: '2026-09-02T05:00:00.000Z' }).result;

    expect(checks.pinnedInputs).toMatchObject({
      studentRecordEffectiveAt: '2026-09-01T05:00:00.000Z',
      auditRecordEffectiveAt: '2026-09-01T05:00:00.000Z',
    });
  });

  it('refers the student with STALE_SOURCE one millisecond past 24 hours', async () => {
    const { result, logger } = check(MATH_102_QUERY, { now: '2026-09-02T05:00:00.001Z' });

    await expect(result).rejects.toBeInstanceOf(StaleSourceError);
    expect(logger.entries[0]?.details).toMatchObject({ reason: 'SOURCE_NOT_FRESH' });
  });

  it('refuses a fresh record whose audit ran against a record older than 24 hours', async () => {
    const oldAudit = {
      ...SEED_AUDITS.current,
      studentRecordEffectiveAt: '2026-08-31T04:59:59.000Z',
    };

    const { result } = check(MATH_102_QUERY, {
      change: (store) => ({ ...store, audits: [oldAudit] }),
    });

    await expect(result).rejects.toBeInstanceOf(StaleSourceError);
  });

  it('refuses a record dated in the future beyond the clock tolerance', async () => {
    await expect(
      check(MATH_102_QUERY, { now: '2026-09-01T04:54:59.999Z' }).result,
    ).rejects.toBeInstanceOf(StaleSourceError);
  });
});
