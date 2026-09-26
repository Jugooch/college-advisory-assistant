/**
 * @file Process entry point: load configuration, build the app, and start listening.
 * @module @caa/api/server
 */
import { buildApp } from './app';
import { loadApiEnv } from './config/env';
import { createControllers } from './container';

const env = loadApiEnv(process.env);
const app = buildApp({ controllers: createControllers(env), isLoggerEnabled: true });

await app.listen({ port: env.API_PORT, host: env.API_HOST });
