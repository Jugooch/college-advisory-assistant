/**
 * @file Shared helpers for the course checks tests: the service over the seeded store, and
 * request, response, and log-line helpers for the HTTP tests. Test code only.
 * @module @caa/api/testing/course-checks-harness
 */
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { z } from 'zod';

import { type CourseChecksResponse, CourseChecksResponseSchema } from '@caa/api-contract';
import type { PrerequisiteRuleRepository } from '@caa/db';
import type { PrerequisiteRule } from '@caa/domain';
import { buildActor, SYNTHETIC_TENANTS } from '@caa/test-kit';

import type { Repositories } from '../container';
import {
  type CourseChecksQuery,
  createCourseChecksService,
} from '../modules/course-checks/course-checks.service';
import type { CourseChecks } from '../modules/course-verification/course-verification.logic';
import { createPinnedRecordsService } from '../modules/pinned-records/pinned-records.service';
import { NotFoundError } from '../shared/domain-errors';
import { bearer, buildWorldApp } from './fixtures';
import {
  createInMemoryAcademicRepositories,
  type InMemoryAcademicStore,
} from './in-memory-academic-repositories';
import {
  createRecordingLogger,
  type InMemoryStore,
  type RecordingLogger,
} from './in-memory-repositories';
import { buildSeedAcademicStore, SEED_RULES, SEED_STUDENTS } from './seed-scenario-fixtures';

/** The actor every service-level check runs as: a user of tenant A. */
export const CHECK_ACTOR = buildActor({ tenantId: SYNTHETIC_TENANTS.a.id });
/** The student every service-level check is for: seeded SYN-000001. */
export const CHECK_STUDENT = SEED_STUDENTS.current;
/** A fixed clock 7 hours after SYN-000001's seeded record and audit record time. */
export const CHECK_NOW = '2026-09-01T12:00:00.000Z';
/** 24 hours. */
const MAX_AGE_MS = 86_400_000;

/** Changes to the seeded store, the ruleset, and the access decision for one check. */
export interface CheckSetup {
  readonly isAllowed?: boolean;
  readonly rulesetVersion?: string | null;
  readonly change?: (store: InMemoryAcademicStore) => InMemoryAcademicStore;
  /** The clock reading; defaults to {@link CHECK_NOW}. */
  readonly now?: string;
  /** Replaces each rule the repository finds, to simulate a repository returning bad data. */
  readonly mapRule?: (rule: PrerequisiteRule) => PrerequisiteRule;
}

/** A started check, and what it recorded. */
export interface CheckRun {
  readonly result: Promise<CourseChecks>;
  readonly logger: RecordingLogger;
  readonly ruleLookups: readonly unknown[];
}

/**
 * Creates the service over the seeded store and checks a query for SYN-000001.
 *
 * @param query - Courses and credit choices.
 * @param setup - Store changes, ruleset, clock, rule changes, and access decision.
 * @returns The check's promise, the recording logger, and the rule lookups made.
 */
export function runCourseChecks(
  query: Omit<CourseChecksQuery, 'studentId'>,
  setup: CheckSetup = {},
): CheckRun {
  const store = (setup.change ?? ((seeded) => seeded))(buildSeedAcademicStore());
  const repositories = createInMemoryAcademicRepositories(store);
  const ruleLookups: unknown[] = [];
  const logger = createRecordingLogger();
  const { mapRule } = setup;
  const service = createCourseChecksService({
    ...repositories,
    prerequisiteRules: {
      findRule: (...args) => {
        ruleLookups.push(args);
        return repositories.prerequisiteRules
          .findRule(...args)
          .then((rule) => (rule === null || mapRule === undefined ? rule : mapRule(rule)));
      },
    },
    students: {
      getStudent: () =>
        setup.isAllowed === false
          ? Promise.reject(new NotFoundError())
          : Promise.resolve(CHECK_STUDENT),
    },
    pinnedRecords: createPinnedRecordsService({
      ...repositories,
      maxSourceAgeMs: MAX_AGE_MS,
      now: () => new Date(setup.now ?? CHECK_NOW),
    }),
    maxSkewMs: 3_600_000,
    rulesetVersion: setup.rulesetVersion === undefined ? 'demo-2026.1' : setup.rulesetVersion,
  });
  const result = service.checkCourses(
    CHECK_ACTOR,
    { studentId: CHECK_STUDENT.id, ...query },
    { logger },
  );
  return { result, logger, ruleLookups };
}

/** One course-checks HTTP request. */
export interface CourseChecksRequest {
  /** Path param, sent as-is. */
  readonly studentId: string;
  /** Dev token, or `null` for no session. */
  readonly token: string | null;
  readonly body: Record<string, unknown>;
}

/**
 * Posts a course-checks request to an app.
 *
 * @param app - The app under test.
 * @param request - The path student, the token, and the body.
 * @returns The injected response.
 */
export function postCourseChecks(
  app: FastifyInstance,
  request: CourseChecksRequest,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: `/v1/students/${request.studentId}/course-checks`,
    headers: request.token === null ? {} : bearer(request.token),
    payload: request.body,
  });
}

/**
 * Parses a success body with the response contract.
 *
 * @param body - The parsed JSON body.
 * @returns The checks.
 */
export function readChecks(body: unknown): CourseChecksResponse {
  return z.object({ data: CourseChecksResponseSchema }).parse(body).data;
}

/** The fields of a pino JSON line the tests read; other fields pass through. */
export const LogLineSchema = z.looseObject({
  msg: z.string(),
  level: z.number(),
  reqId: z.string().optional(),
});

/** One parsed log line. */
export type LogLine = z.infer<typeof LogLineSchema>;

/**
 * Parses captured JSON log lines.
 *
 * @param lines - Serialized pino lines.
 * @returns The parsed lines.
 */
export function readLogLines(lines: readonly string[]): LogLine[] {
  return lines.map((line) => LogLineSchema.parse(JSON.parse(line)));
}

/**
 * Builds the world app over the seeded academic store, capturing its JSON log lines.
 *
 * @param repositoryOverrides - Repositories to use instead of the in-memory ones.
 * @returns The app, its mutable store, and the captured lines.
 */
export function buildSeededWorldApp(repositoryOverrides: Partial<Repositories> = {}): {
  readonly app: FastifyInstance;
  readonly store: InMemoryStore;
  readonly lines: string[];
} {
  const lines: string[] = [];
  const { app, store } = buildWorldApp({ write: (line) => lines.push(line) }, repositoryOverrides);
  Object.assign(store, buildSeedAcademicStore());
  return { app, store, lines };
}

/**
 * A rule repository that returns each seeded rule at another ruleset, whatever was asked for,
 * to simulate a repository that ignores its ruleset filter.
 *
 * @param rulesetVersion - The ruleset every returned rule claims.
 * @returns The repository.
 */
export function rulesAtRuleset(rulesetVersion: string): PrerequisiteRuleRepository {
  return {
    findRule: (_tenantId, courseId) => {
      const rule = SEED_RULES.find((seeded) => seeded.courseId === courseId);
      return Promise.resolve(rule === undefined ? null : { ...rule, rulesetVersion });
    },
  };
}
