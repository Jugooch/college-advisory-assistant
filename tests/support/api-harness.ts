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
import type { AdvisorAssignment, Student, UserIdentity } from '@caa/domain';

/** Fixed instant every API acceptance case runs at. */
export const ACCEPTANCE_NOW = new Date('2026-09-01T12:00:00.000Z');

/** The API app, not yet listening. */
export type AcceptanceApp = ReturnType<typeof buildApp>;

/** Mutable backing data. Every repository call reads it again, so a case can change it mid-session. */
export interface AcceptanceWorld {
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
 * Builds the API with dev auth over the world, at {@link ACCEPTANCE_NOW}. Call it once per file at
 * module scope and mutate the world between cases: the first build in a worker loads Fastify's
 * schema compilers, which can take seconds on a slow disk and would count against a case's timeout.
 *
 * @param world - Backing data; mutate it between requests to change what the API sees.
 * @param tokens - Dev tokens the API accepts.
 * @returns The app.
 */
export function buildAcceptanceApp(
  world: AcceptanceWorld,
  tokens: readonly AcceptanceToken[],
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
  });
  const repositories: Repositories = {
    userIdentities: createIdentities(world),
    students: createStudents(world),
    advisorAssignments: createAssignments(world),
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
