/**
 * @file Prepares the demo's dynamic state through the public API. Started by `scripts/demo.mjs`
 * under `tsx`, because it uses the typed client from `@caa/api-contract`, which is TypeScript.
 * Reads the API URL from the environment `scripts/demo.mjs` sets.
 * @module scripts/demo-prepare
 * @requirement FR-11
 * @requirement FR-12
 * @see docs/adr/0016-browser-end-to-end-tests-and-local-demo.md
 */
import { spawn } from 'node:child_process';

import {
  createApiClient,
  createCaseEndpoint,
  findScheduleOptionsEndpoint,
  getPlannableTermsEndpoint,
  listAdvisorCasesEndpoint,
  savePlanEndpoint,
} from '@caa/api-contract';

import { prepareDemoState } from './lib/demo-state.mjs';

const ENDPOINTS = {
  getPlannableTerms: getPlannableTermsEndpoint,
  findScheduleOptions: findScheduleOptionsEndpoint,
  savePlan: savePlanEndpoint,
  createCase: createCaseEndpoint,
  listAdvisorCases: listAdvisorCasesEndpoint,
};

const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * Calls a named endpoint as the holder of a dev token.
 *
 * @param {string} token - Dev bearer token.
 * @param {string} name - Key of {@link ENDPOINTS}.
 * @param {object} [options] - `{ params, query, body }` for the typed client.
 * @returns {Promise<any>} The validated response data.
 */
function call(token, name, options) {
  const client = createApiClient({
    baseUrl,
    getHeaders: async () => ({ authorization: `Bearer ${token}` }),
  });
  return client.call(ENDPOINTS[name], options);
}

/**
 * Publishes a newer synthetic source revision for one persona, through the existing command.
 *
 * @param {string} sourceStudentId - For example `SYN-000006`.
 * @returns {Promise<void>} Resolves when the command exits cleanly.
 */
function revise(sourceStudentId) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'pnpm',
      ['--filter', '@caa/db', 'db:seed:revise', '--', '--student', sourceStudentId],
      { stdio: 'inherit', env: process.env },
    );
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`db:seed:revise exited with code ${code}`)),
    );
  });
}

try {
  const state = await prepareDemoState({ call, revise, log: (message) => console.log(message) });
  console.log(JSON.stringify({ cases: state.cases }));
} catch (error) {
  // SECURITY: only the error name and message are shown; request bodies and tokens never are.
  console.error(`Demo preparation failed: ${error instanceof Error ? error.message : 'unknown'}`);
  process.exitCode = 1;
}
