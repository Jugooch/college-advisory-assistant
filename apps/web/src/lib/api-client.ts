/**
 * @file The shared API client instance for the web app.
 * @module @caa/web/lib/api-client
 * @requirement FR-01
 */
import { cookies } from 'next/headers';

import { createApiClient } from '@caa/api-contract';

import { readSessionToken } from './session-cookie';

/**
 * Builds the headers that identify the signed-in user to the API.
 *
 * @returns A bearer authorization header, or no headers when there is no session.
 */
async function sessionHeaders(): Promise<Record<string, string>> {
  // SECURITY: the only identity the web app sends is the session cookie's token. Tenant, user,
  // and role are resolved by the API from it, never supplied by the browser.
  const token = readSessionToken(await cookies());
  return token === null ? {} : { authorization: `Bearer ${token}` };
}

/** Client used by every function in `src/api`. Do not create other clients. */
export const apiClient = createApiClient({
  baseUrl: process.env.API_BASE_URL ?? 'http://localhost:4000',
  getHeaders: sessionHeaders,
});
