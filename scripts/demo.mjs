/**
 * @file `pnpm demo`: resets the local database, loads the demo seed, starts the stack with the
 * demo model and dev sign-in, prepares the dynamic state through the API, and prints how to sign
 * in. Local only: it refuses a non-local database or production before any write.
 * @module scripts/demo
 * @requirement NFR-05
 * @see docs/adr/0016-browser-end-to-end-tests-and-local-demo.md
 */
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';

import {
  API_PORT,
  assertDemoAllowed,
  buildDemoEnv,
  DemoRefusedError,
  describeDatabaseDown,
  describeReady,
} from './lib/demo.mjs';

const PREPARE_SCRIPT = fileURLToPath(new URL('./demo-prepare.mjs', import.meta.url));
const HEALTH_TIMEOUT_MS = 180_000;
const HEALTH_INTERVAL_MS = 1_000;

/**
 * Checks that something accepts connections at the database host and port.
 *
 * @param {{ host: string, port: number }} target - The database target.
 * @returns {Promise<boolean>} Whether a connection opened.
 */
function isReachable({ host, port }) {
  return new Promise((resolve) => {
    const socket = connect({ host, port, timeout: 3_000 });
    const finish = (reachable) => {
      socket.destroy();
      resolve(reachable);
    };
    socket.on('connect', () => finish(true));
    socket.on('error', () => finish(false));
    socket.on('timeout', () => finish(false));
  });
}

/**
 * Returns the last non-empty line of a command's whole output.
 *
 * @param {string} output - Everything the command wrote to stdout.
 * @returns {string} The line, or an empty string.
 */
function lastLine(output) {
  return (
    output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .at(-1) ?? ''
  );
}

/**
 * Runs a command to completion with the demo environment.
 *
 * @param {string[]} args - Arguments to `pnpm`.
 * @param {Record<string, string>} env - Child environment.
 * @param {boolean} [captureLast] - Return the last stdout line instead of inheriting stdout.
 * @returns {Promise<string>} The last stdout line when captured, else an empty string.
 */
function run(args, env, captureLast = false) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, {
      env,
      stdio: ['ignore', captureLast ? 'pipe' : 'inherit', 'inherit'],
    });
    let output = '';
    child.stdout?.on('data', (chunk) => {
      process.stdout.write(chunk);
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolve(lastLine(output))
        : reject(new Error(`pnpm ${args[0]} exited with code ${code}`)),
    );
  });
}

/**
 * Waits until the API answers its health check.
 *
 * @param {AbortSignal} signal - Aborted when the stack stops early.
 * @returns {Promise<void>} Resolves when healthy.
 * @throws {Error} When the API is not healthy in time.
 */
async function waitForApi(signal) {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline && !signal.aborted) {
    try {
      const response = await fetch(`http://localhost:${API_PORT}/v1/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // NOTE: not listening yet; try again.
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_INTERVAL_MS));
  }
  throw new Error('The API did not become healthy; see the output above.');
}

/**
 * Runs the demo.
 *
 * @returns {Promise<void>} Resolves when the stack stops.
 */
async function main() {
  const target = assertDemoAllowed(process.env);
  if (!(await isReachable(target))) {
    console.error(describeDatabaseDown(target));
    process.exitCode = 1;
    return;
  }
  const env = buildDemoEnv(process.env, target.databaseUrl);
  await run(['--filter', '@caa/db', 'db:reset'], env);
  await run(['--filter', '@caa/db', 'db:seed:demo'], env);

  const stack = spawn('pnpm', ['dev'], { env, stdio: 'inherit' });
  const stopped = new Promise((resolve) => stack.on('exit', resolve));
  const abort = new AbortController();
  stopped.then(() => abort.abort());
  let interrupted = false;
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      interrupted = true;
      stack.kill(signal);
    });
  }
  try {
    await waitForApi(abort.signal);
    const last = await run(['exec', 'tsx', PREPARE_SCRIPT], env, true);
    console.log(describeReady(JSON.parse(last)));
  } catch (error) {
    if (!interrupted) {
      console.error(error instanceof Error ? error.message : 'The demo could not be prepared.');
      process.exitCode = 1;
    }
    stack.kill('SIGTERM');
  }
  await stopped;
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof DemoRefusedError ? error.message : `Demo failed: ${error.message}`,
  );
  process.exitCode = 1;
}
