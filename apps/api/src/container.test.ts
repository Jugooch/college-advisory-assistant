/**
 * @file Tests that the composition root picks the session resolver from the configured auth mode.
 * @requirement FR-01
 */
import { describe, expect, it } from 'vitest';

import { buildUserIdentity } from '@caa/test-kit';

import { loadApiEnv } from './config/env';
import { createContainer, createRuntimeDependencies } from './container';
import {
  createInMemoryRepositories,
  createRecordingLogger,
} from './testing/in-memory-repositories';

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
  const logger = createRecordingLogger();
  return createContainer({ env, repositories, logger, now: () => new Date() }).sessionResolver;
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

    const dependencies = createRuntimeDependencies(env, createRecordingLogger());

    expect(Object.keys(dependencies.controllers)).toEqual(['health', 'session', 'students']);
  });
});
