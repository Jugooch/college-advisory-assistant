/**
 * @file Builds the real API over QA-owned in-memory repositories so acceptance cases can call it
 * through `app.inject`. The app is reached only through the `@caa/api/testing` entry point.
 * Its in-memory fakes deliberately don't reuse the API team's fakes, so the acceptance oracle stays
 * independent of the code under test (docs/standards/07-testing.md, Acceptance tests).
 * @module @caa/tests/support/api-harness
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/standards/07-testing.md
 */
import {
  type AdvisorAssignmentRepository,
  AuthMode,
  buildApp,
  createContainer,
  type DevTokenIdentity,
  loadApiEnv,
  type Repositories,
  type StudentRepository,
  type UserIdentityRepository,
} from '@caa/api/testing';
import type { StudentUserLinkRepository } from '@caa/db';
import type { AdvisorAssignment, Student, UserIdentity } from '@caa/domain';

import { type AcademicWorld, createAcademicRepositories } from './academic-repositories';
import { createPlanRepositories, type PlanRepositories, type PlanWorld } from './plan-repositories';
import {
  createProgramRepositories,
  type ProgramRepositories,
  type ProgramWorld,
} from './program-repositories';
import {
  createScheduleRepositories,
  type ScheduleRepositories,
  type ScheduleWorld,
} from './schedule-repositories';

/** Fixed instant every API acceptance case runs at. */
export const ACCEPTANCE_NOW = new Date('2026-09-01T12:00:00.000Z');

/** The ruleset version the harness's API runs course checks under. */
export const ACCEPTANCE_RULESET_VERSION = 'demo-2026.1';

/**
 * How old the pinned record and the audit's record time may be for course checks: 24 hours, the
 * proposed maximum age of a transcript, program, or audit (planning/09 §Proposed freshness
 * policies). Set explicitly so cases don't depend on the API's development default.
 */
export const ACCEPTANCE_SOURCE_MAX_AGE_MS = 86_400_000;

/**
 * The allowed skew between a record and the audit run against it: one hour, the skew the golden
 * AC10 cases use (planning/07 §Consistency model). Set explicitly, like the maximum age.
 */
export const ACCEPTANCE_AUDIT_SKEW_MS = 3_600_000;

/** The schedule solver's documented default work cap (ADR-0010 §1), unless a case sets another. */
export const ACCEPTANCE_SOLVER_WORK_CAP = 3_000_000;

/** API settings a case may vary. */
export interface AcceptanceOptions {
  /** `SCHEDULE_SOLVER_WORK_CAP`; defaults to {@link ACCEPTANCE_SOLVER_WORK_CAP}. */
  readonly solverWorkCap?: number;
}

/** The API app, not yet listening. */
export type AcceptanceApp = ReturnType<typeof buildApp>;

/**
 * Mutable backing data. Every repository call reads it again, so a case can change it mid-session.
 * The academic fields (snapshots, audits, catalog, rules, policies, terms) and the schedule fields
 * (section snapshots, transition tables) are optional: a case seeds only what it reads, and an
 * omitted field means nothing of that kind is stored.
 */
export interface AcceptanceWorld extends AcademicWorld, ScheduleWorld, ProgramWorld, PlanWorld {
  identities: readonly UserIdentity[];
  students: readonly Student[];
  assignments: readonly AdvisorAssignment[];
}

/** A dev bearer token and the identity it signs in as. */
export interface AcceptanceToken {
  readonly token: string;
  readonly identity: UserIdentity;
}

/** A plain HTTP response as seen by a client. */
export interface AcceptanceResponse {
  readonly statusCode: number;
  readonly body: unknown;
}

/**
 * Creates the user identity repository over the world.
 *
 * @param world - Backing data.
 * @returns A {@link UserIdentityRepository}.
 */
function createIdentities(world: AcceptanceWorld): UserIdentityRepository {
  return {
    findByIssuerSubject: (issuer, subject) =>
      Promise.resolve(
        world.identities.find((item) => item.issuer === issuer && item.subject === subject) ?? null,
      ),
  };
}

/**
 * Creates the student repository over the world. Like the contract says, a student in another
 * tenant is never returned.
 *
 * @param world - Backing data.
 * @returns A {@link StudentRepository}.
 */
function createStudents(world: AcceptanceWorld): StudentRepository {
  return {
    findById: (tenantId, id) =>
      Promise.resolve(
        world.students.find((item) => item.tenantId === tenantId && item.id === id) ?? null,
      ),
    findBySourceStudentId: (tenantId, sourceStudentId) =>
      Promise.resolve(
        world.students.find(
          (item) => item.tenantId === tenantId && item.sourceStudentId === sourceStudentId,
        ) ?? null,
      ),
  };
}

/**
 * Creates the student-user link repository over the world: the student in the tenant whose
 * `userId` is the signed-in user. Like the contract says, another tenant's student is never
 * returned, and a user linked to two students is an error, never a pick.
 *
 * @param world - Backing data.
 * @returns A {@link StudentUserLinkRepository}. Its `findByUserId` rejects with an error when
 *   more than one student in the tenant is linked to the user.
 * @throws {Error} When more than one student in the tenant is linked to the user (from the
 *   returned `findByUserId`, as a rejected promise).
 */
export function createStudentUserLinks(world: AcceptanceWorld): StudentUserLinkRepository {
  return {
    findByUserId: (tenantId, userId) => {
      const linked = world.students.filter(
        (item) => item.tenantId === tenantId && item.userId === userId,
      );
      if (linked.length > 1) {
        return Promise.reject(new Error('More than one student is linked to the user'));
      }
      return Promise.resolve(linked[0] ?? null);
    },
  };
}

/**
 * Creates the advisor assignment repository over the world. An assignment is active from
 * `effectiveFrom` (inclusive) until `effectiveTo` (exclusive, or open when null).
 *
 * @param world - Backing data.
 * @returns An {@link AdvisorAssignmentRepository}.
 */
function createAssignments(world: AcceptanceWorld): AdvisorAssignmentRepository {
  return {
    findActive: (tenantId, { advisorUserId, studentId, at }) => {
      const instant = Date.parse(at);
      const active = world.assignments.find(
        (item) =>
          item.tenantId === tenantId &&
          item.advisorUserId === advisorUserId &&
          item.studentId === studentId &&
          Date.parse(item.effectiveFrom) <= instant &&
          (item.effectiveTo === null || instant < Date.parse(item.effectiveTo)),
      );
      return Promise.resolve(active ?? null);
    },
  };
}

/**
 * Builds the API with dev auth over the world, at {@link ACCEPTANCE_NOW}, running course checks
 * under {@link ACCEPTANCE_RULESET_VERSION}, with {@link ACCEPTANCE_SOURCE_MAX_AGE_MS} and
 * {@link ACCEPTANCE_AUDIT_SKEW_MS}. Every repository the API has, the academic ones
 * included, reads the world, so no endpoint hits a missing repository. Call it once per file at
 * module scope and mutate the world between cases: the first build in a worker loads Fastify's
 * schema compilers, which can take seconds on a slow disk and would count against a case's timeout.
 *
 * @param world - Backing data; mutate it between requests to change what the API sees.
 * @param tokens - Dev tokens the API accepts.
 * @param options - Settings a case varies, such as the solver work cap.
 * @returns The app.
 */
export function buildAcceptanceApp(
  world: AcceptanceWorld,
  tokens: readonly AcceptanceToken[],
  options: AcceptanceOptions = {},
): AcceptanceApp {
  const tokenMap: Record<string, DevTokenIdentity> = Object.fromEntries(
    tokens.map(({ token, identity }) => [
      token,
      { issuer: identity.issuer, subject: identity.subject },
    ]),
  );
  const env = loadApiEnv({
    NODE_ENV: 'test',
    APP_VERSION: 'acceptance',
    DATABASE_URL: 'postgres://unused.invalid/acceptance',
    AUTH_MODE: AuthMode.Dev,
    DEV_AUTH_TOKENS: JSON.stringify(tokenMap),
    ACTIVE_RULESET_VERSION: ACCEPTANCE_RULESET_VERSION,
    ACADEMIC_SOURCE_MAX_AGE_MS: String(ACCEPTANCE_SOURCE_MAX_AGE_MS),
    AUDIT_RECORD_MAX_SKEW_MS: String(ACCEPTANCE_AUDIT_SKEW_MS),
    SCHEDULE_SOLVER_WORK_CAP: String(options.solverWorkCap ?? ACCEPTANCE_SOLVER_WORK_CAP),
  });
  // NOTE: the intersection lets the harness provide repositories before the API adds them to
  // `Repositories`: `studentUserLinks` (#151), the schedule ones (#221), and `programs` (#187), and `plans` (#409). Once they're there,
  // the intersection is redundant and can go.
  const repositories: Repositories & {
    studentUserLinks: StudentUserLinkRepository;
  } & ScheduleRepositories &
    ProgramRepositories &
    PlanRepositories = {
    userIdentities: createIdentities(world),
    students: createStudents(world),
    studentUserLinks: createStudentUserLinks(world),
    advisorAssignments: createAssignments(world),
    ...createAcademicRepositories(world),
    ...createScheduleRepositories(world),
    ...createProgramRepositories(world),
    ...createPlanRepositories(world),
  };
  return buildApp({
    dependencies: createContainer({ env, repositories, now: () => ACCEPTANCE_NOW }),
    logger: false,
  });
}

/**
 * Sends `GET <url>` the way a browser would, with an optional raw `Authorization` header.
 *
 * @param app - App under test.
 * @param url - Request path.
 * @param authorization - Raw header value, or null to send no header.
 * @returns Status code and parsed JSON body.
 */
export async function getAs(
  app: AcceptanceApp,
  url: string,
  authorization: string | null,
): Promise<AcceptanceResponse> {
  const headers = authorization === null ? {} : { authorization };
  const response = await app.inject({ method: 'GET', url, headers });
  return { statusCode: response.statusCode, body: response.json() };
}

/** A JSON `POST` request with a raw `Authorization` header. */
export interface AcceptancePost {
  readonly url: string;
  readonly authorization: string;
  readonly payload: object;
}

/**
 * Sends `POST <url>` with a JSON body, the way a browser would.
 *
 * @param app - App under test.
 * @param request - Path, raw `Authorization` header value, and JSON body.
 * @returns Status code and parsed JSON body.
 */
export async function postAs(
  app: AcceptanceApp,
  { url, authorization, payload }: AcceptancePost,
): Promise<AcceptanceResponse> {
  const response = await app.inject({
    method: 'POST',
    url,
    headers: { authorization, 'content-type': 'application/json' },
    payload: JSON.stringify(payload),
  });
  return { statusCode: response.statusCode, body: response.json() };
}

/** The client-visible shape of an error response, with the per-request ID left out. */
export interface ErrorSummary {
  readonly statusCode: number;
  /** Top-level body keys, sorted. `['error']` for a well-formed envelope. */
  readonly bodyKeys: readonly string[];
  /** Keys inside `error`, sorted. */
  readonly errorKeys: readonly string[];
  readonly code: unknown;
  readonly message: unknown;
}

/**
 * Summarizes an error response so it can be compared literally, or against another response.
 *
 * @param response - Response to summarize.
 * @returns Status, body and envelope keys, code, and message.
 */
export function summarizeError(response: AcceptanceResponse): ErrorSummary {
  const body: Record<string, unknown> =
    typeof response.body === 'object' && response.body !== null ? { ...response.body } : {};
  const error: Record<string, unknown> =
    typeof body.error === 'object' && body.error !== null ? { ...body.error } : {};
  return {
    statusCode: response.statusCode,
    bodyKeys: Object.keys(body).sort(),
    errorKeys: Object.keys(error).sort(),
    code: error.code,
    message: error.message,
  };
}
