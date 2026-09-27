/**
 * @file Builds the real app over in-memory repositories, with dev auth, for `app.inject` tests.
 * @module @caa/api/testing/test-app
 * @see docs/standards/07-testing.md
 */
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../app';
import { loadApiEnv } from '../config/env';
import { createContainer } from '../container';
import type { DevTokenIdentity } from '../modules/session/session.service';
import { createInMemoryRepositories, type InMemoryStore } from './in-memory-repositories';

/** Options for {@link buildTestApp}. */
export interface TestAppOptions {
  readonly store: InMemoryStore;
  /** Dev tokens and the identity each one signs in as. */
  readonly tokens: Readonly<Record<string, DevTokenIdentity>>;
  /** Fixed clock for the app. */
  readonly now: () => Date;
}

/**
 * Builds the app the way the server does, but over in-memory data and with `AUTH_MODE=dev`.
 *
 * @param options - Backing data, dev tokens, and clock.
 * @returns The Fastify instance, not yet listening.
 */
export function buildTestApp(options: TestAppOptions): FastifyInstance {
  const env = loadApiEnv({
    NODE_ENV: 'test',
    APP_VERSION: 'test',
    DATABASE_URL: 'postgres://unused.invalid/test',
    AUTH_MODE: 'dev',
    DEV_AUTH_TOKENS: JSON.stringify(options.tokens),
  });
  const repositories = createInMemoryRepositories(options.store);
  return buildApp({
    createDependencies: (logger) =>
      createContainer({ env, repositories, logger, now: options.now }),
    isLoggerEnabled: false,
  });
}
