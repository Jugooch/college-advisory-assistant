/**
 * @file Tests that the composition root picks the session resolver from the configured auth mode,
 * wires every controller, and requires every repository.
 * @requirement FR-01
 */
import { describe, expect, it } from 'vitest';

import { buildUserIdentity } from '@caa/test-kit';

import { loadApiEnv } from './config/env';
import { createContainer, createRuntimeDependencies, type Repositories } from './container';
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
      'scheduleOptions',
    ]);
  });
});

describe('Repositories', () => {
  it('requires every academic repository, so a missing one fails typecheck, not at runtime', () => {
    const { userIdentities, students, advisorAssignments } = repositories;

    // @ts-expect-error -- the compiler rejects repositories without the academic ones.
    const incomplete: Repositories = { userIdentities, students, advisorAssignments };

    expect(Object.keys(incomplete)).toEqual(['userIdentities', 'students', 'advisorAssignments']);
  });
});
