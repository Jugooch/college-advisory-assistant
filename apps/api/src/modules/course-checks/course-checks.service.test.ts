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
import { buildActor, buildCourse, SYNTHETIC_TENANTS } from '@caa/test-kit';

import {
  InvalidRequestError,
  NotFoundError,
  SourceUnavailableError,
} from '../../shared/domain-errors';
import {
  createInMemoryAcademicRepositories,
  type InMemoryAcademicStore,
} from '../../testing/in-memory-academic-repositories';
import { createRecordingLogger } from '../../testing/in-memory-repositories';
import {
  buildSeedAcademicStore,
  SEED_COURSES,
  SEED_STUDENTS,
} from '../../testing/seed-scenario-fixtures';
import { createPinnedRecordsService } from '../pinned-records/pinned-records.service';
import {
  type CourseChecksQuery,
  createCourseChecksService,
  RulesetNotConfiguredError,
} from './course-checks.service';

const actor = buildActor({ tenantId: SYNTHETIC_TENANTS.a.id });
const student = SEED_STUDENTS.current;
const { math102, ind390, engl101 } = SEED_COURSES;

/** Changes to the seeded store, the ruleset, and the access decision for one test. */
interface Setup {
  readonly isAllowed?: boolean;
  readonly rulesetVersion?: string | null;
  readonly change?: (store: InMemoryAcademicStore) => InMemoryAcademicStore;
}

/**
 * Creates the service over the seeded store and checks a query for SYN-000001.
 *
 * @param query - Courses and credit choices.
 * @param setup - Store changes, ruleset, and access decision.
 * @returns The check's promise, the recording logger, and the rule lookups made.
 */
function check(query: Omit<CourseChecksQuery, 'studentId'>, setup: Setup = {}) {
  const store = (setup.change ?? ((seeded) => seeded))(buildSeedAcademicStore());
  const repositories = createInMemoryAcademicRepositories(store);
  const ruleLookups: unknown[] = [];
  const logger = createRecordingLogger();
  const service = createCourseChecksService({
    ...repositories,
    prerequisiteRules: {
      findRule: (...args) => {
        ruleLookups.push(args);
        return repositories.prerequisiteRules.findRule(...args);
      },
    },
    students: {
      getStudent: () =>
        setup.isAllowed === false ? Promise.reject(new NotFoundError()) : Promise.resolve(student),
    },
    pinnedRecords: createPinnedRecordsService(repositories),
    maxSkewMs: 3_600_000,
    rulesetVersion: setup.rulesetVersion === undefined ? 'demo-2026.1' : setup.rulesetVersion,
  });
  const result = service.checkCourses(actor, { studentId: student.id, ...query }, { logger });
  return { result, logger, ruleLookups };
}

describe('CourseChecksService.checkCourses', () => {
  it('returns every check dimension for each course and for the set', async () => {
    const checks = await check({ courseIds: [math102.id, engl101.id] }).result;

    expect(checks.courseResults.map((result) => result.courseId)).toEqual([math102.id, engl101.id]);
    expect(checks.courseResults[0]?.prerequisite?.kind).toBe('PREREQUISITE');
    expect(checks.courseResults[1]?.prerequisite).toBeNull();
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

  it('turns an engine input error into INVALID_REQUEST, logging only its name', async () => {
    const { result, logger } = check({
      courseIds: [ind390.id],
      creditSelections: [{ courseId: ind390.id, selectedCreditsHundredths: 900 }],
    });

    await expect(result).rejects.toBeInstanceOf(InvalidRequestError);
    expect(logger.entries[0]?.details).toMatchObject({ reason: 'CandidateSetInputError' });
  });

  it('logs the run with opaque IDs, versions, and the aggregate only', async () => {
    const { result, logger } = check({ courseIds: [math102.id] });

    const checks = await result;

    expect(logger.entries).toEqual([
      {
        level: 'info',
        message: 'course checks run',
        details: {
          actorUserId: actor.userId,
          tenantId: actor.tenantId,
          studentId: student.id,
          ...checks.pinnedInputs,
          courseCount: 1,
          aggregate: checks.aggregate,
        },
      },
    ]);
    expect(JSON.stringify(logger.entries)).not.toContain(student.sourceStudentId);
  });
});
