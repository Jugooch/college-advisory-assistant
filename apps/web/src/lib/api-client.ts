/**
 * @file The shared API client instance for the web app.
 * @module @caa/web/lib/api-client
 */
import { createApiClient } from '@caa/api-contract';

/** Client used by every function in `src/api`. Do not create other clients. */
export const apiClient = createApiClient({
  baseUrl: process.env.API_BASE_URL ?? 'http://localhost:4000',
});
