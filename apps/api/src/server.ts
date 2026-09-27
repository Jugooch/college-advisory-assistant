/**
 * @file Process entry point: load configuration, build the app, and start listening.
 * @module @caa/api/server
 */
import { buildApp } from './app';
import { loadApiEnv } from './config/env';
import { createRuntimeDependencies } from './container';

const env = loadApiEnv(process.env);
const app = buildApp({
  dependencies: createRuntimeDependencies(env),
  logger: true,
});

await app.listen({ port: env.API_PORT, host: env.API_HOST });
