/**
 * @file Tests that the composition root picks the session resolver from the configured auth mode.
 * @requirement FR-01
 */
import { describe, expect, it } from 'vitest';

import { ErrorCode } from '@caa/domain';
import { buildStudent, buildUserIdentity } from '@caa/test-kit';

import { buildApp } from './app';
import { loadApiEnv } from './config/env';
import { createContainer, createRuntimeDependencies } from './container';
import { createInMemoryRepositories } from './testing/in-memory-repositories';

const identity = buildUserIdentity();
const tokens = JSON.stringify({
  'dev-token-1': { issuer: identity.issuer, subject: identity.subject },
});
const repositories = createInMemoryRepositories({
  identities: [identity],
  students: [],
  assignments: [],
});

/**
 * Builds the container over in-memory data for one auth mode.
 *
 * @param authMode - Value of `AUTH_MODE`.
 * @returns The container's session resolver.
 */
function resolverFor(authMode: string) {
  const env = loadApiEnv({
    DATABASE_URL: 'postgres://unused.invalid/test',
    AUTH_MODE: authMode,
    DEV_AUTH_TOKENS: tokens,
  });
  return createContainer({ env, repositories, now: () => new Date() }).sessionResolver;
}

describe('createContainer', () => {
  it('signs dev tokens in when AUTH_MODE=dev', async () => {
    expect(await resolverFor('dev').resolve('dev-token-1')).toMatchObject({ userId: identity.id });
  });

  it('denies the same dev token when AUTH_MODE=none', async () => {
    expect(await resolverFor('none').resolve('dev-token-1')).toBeNull();
  });
});

describe('createRuntimeDependencies', () => {
  it('wires every controller without connecting to the database', () => {
    const env = loadApiEnv({ DATABASE_URL: 'postgres://unused.invalid/test' });

    const dependencies = createRuntimeDependencies(env);

    expect(Object.keys(dependencies.controllers)).toEqual([
      'health',
      'session',
      'students',
      'academicSummary',
      'courseChecks',
    ]);
  });
});

const unwiredStudent = buildStudent({ userId: identity.id });
// NOTE: built at module scope so Fastify's startup cost never counts against a test's timeout (#83).
const unwiredApp = (() => {
  const { userIdentities, students, advisorAssignments } = createInMemoryRepositories({
    identities: [identity],
    students: [unwiredStudent],
    assignments: [],
  });
  const env = loadApiEnv({
    DATABASE_URL: 'postgres://unused.invalid/test',
    AUTH_MODE: 'dev',
    DEV_AUTH_TOKENS: tokens,
  });
  return buildApp({
    dependencies: createContainer({
      env,
      repositories: { userIdentities, students, advisorAssignments },
      now: () => new Date('2026-09-01T12:00:00.000Z'),
    }),
    logger: false,
  });
})();

describe('createContainer without the academic repositories', () => {
  it('fails an academic summary read closed with INTERNAL_ERROR, never "no record"', async () => {
    const response = await unwiredApp.inject({
      method: 'GET',
      url: `/v1/students/${unwiredStudent.id}/academic-summary`,
      headers: { authorization: 'Bearer dev-token-1' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ error: { code: ErrorCode.InternalError } });
  });
});
