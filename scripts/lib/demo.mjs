/**
 * @file Pure rules of the one-command local demo: the personas and their dev tokens, the guard
 * that keeps the demo on a local, non-production database, the environment the stack runs with,
 * and the text the demo prints.
 * @module scripts/lib/demo
 * @requirement FR-01
 * @requirement NFR-05
 * @see docs/adr/0016-browser-end-to-end-tests-and-local-demo.md
 */

/** Hosts the demo may reset and seed. Anything else is treated as someone else's database. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/** Synthetic identity provider the demo tokens sign in against. */
const ISSUER = 'https://idp.synthetic.example';

/**
 * The demo sign-ins. Student numbers match the persona numbers in `@caa/db`
 * (`dev-seed-demo-plan.ts`): the student ID is `30000000-0000-4000-8000-00000000000N`.
 */
export const DEMO_PERSONAS = Object.freeze([
  {
    token: 'dev-token-student',
    subject: 'synthetic-student-001',
    studentId: '30000000-0000-4000-8000-000000000001',
    role: 'student',
    shows: 'on track, with a current record',
  },
  {
    token: 'dev-token-student-blocked',
    subject: 'synthetic-student-004',
    studentId: '30000000-0000-4000-8000-000000000004',
    sourceStudentId: 'SYN-000004',
    role: 'student',
    shows: 'blocked prerequisite (MATH 101 with a D)',
  },
  {
    token: 'dev-token-student-unknown',
    subject: 'synthetic-student-005',
    studentId: '30000000-0000-4000-8000-000000000005',
    sourceStudentId: 'SYN-000005',
    role: 'student',
    shows: 'UNKNOWN data (pending transfer credit)',
  },
  {
    token: 'dev-token-student-stale',
    subject: 'synthetic-student-006',
    studentId: '30000000-0000-4000-8000-000000000006',
    sourceStudentId: 'SYN-000006',
    role: 'student',
    shows: 'a saved plan that has gone STALE',
  },
  {
    token: 'dev-token-advisor',
    subject: 'synthetic-advisor-001',
    studentId: null,
    role: 'advisor',
    shows: 'the advisor queue, with two open cases',
  },
  {
    token: 'dev-token-advisor-2',
    subject: 'synthetic-advisor-002',
    studentId: null,
    role: 'advisor',
    shows: 'a second advisor with no assigned students',
  },
  {
    token: 'dev-token-admin',
    subject: 'synthetic-admin-001',
    studentId: null,
    role: 'admin',
    shows: 'the approver of the advisor assignments',
  },
]);

/** The settings the demo forces; they override whatever the shell exports. */
export const DEMO_FIXED_ENV = Object.freeze({
  NODE_ENV: 'development',
  AUTH_MODE: 'dev',
  CONVERSATION_MODEL: 'demo',
  ACTIVE_RULESET_VERSION: 'demo-2026.1',
});

/** Local database the demo uses when `DATABASE_URL` is unset; matches infra/docker-compose.yml. */
export const DEFAULT_DATABASE_URL = 'postgres://caa:caa@localhost:5432/caa';
/** Port the API listens on in the demo. */
export const API_PORT = 4000;
/** Port the web app listens on in the demo. */
export const WEB_PORT = 3000;

/** Thrown when the demo is asked to touch a database it must never touch. */
export class DemoRefusedError extends Error {
  /**
   * Creates the error.
   *
   * @param {string} reason - Why the demo was refused; never contains the connection string.
   */
  constructor(reason) {
    super(`Refusing to run the demo: ${reason}`);
    this.name = 'DemoRefusedError';
  }
}

/**
 * Builds the `DEV_AUTH_TOKENS` value: each demo token mapped to its synthetic identity.
 *
 * @returns {string} One-line JSON.
 */
export function buildDevAuthTokens() {
  const tokens = Object.fromEntries(
    DEMO_PERSONAS.map((persona) => [persona.token, { issuer: ISSUER, subject: persona.subject }]),
  );
  return JSON.stringify(tokens);
}

/**
 * Decides whether the demo may run, before anything connects or writes.
 *
 * SECURITY: the demo wipes the database it is pointed at, so only a local, non-production one is
 * allowed. This mirrors `assertResetAllowed` in `packages/db/src/seed/reset-command.ts`, which
 * `db:reset` still runs itself; keep the two in step. The host is read from the URL, and a URL that can name another target through query
 * parameters (`host`, `hostaddr`, `port`) is refused outright.
 *
 * @param {Record<string, string | undefined>} env - Process environment.
 * @returns {{ databaseUrl: string, host: string, port: number }} The accepted database target.
 * @throws {DemoRefusedError} When `NODE_ENV` is production, or the database is not local.
 */
export function assertDemoAllowed(env) {
  // TODO(#614): replace this copy with the shared guard once @caa/db exports it.
  if (env.NODE_ENV === 'production') {
    throw new DemoRefusedError('NODE_ENV is production');
  }
  const databaseUrl = env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new DemoRefusedError('DATABASE_URL is not a valid URL, so its host cannot be checked');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new DemoRefusedError('DATABASE_URL is not a postgres URL');
  }
  const keys = [...url.searchParams.keys()].map((key) => key.toLowerCase());
  if (keys.some((key) => key === 'host' || key === 'hostaddr' || key === 'port')) {
    throw new DemoRefusedError('DATABASE_URL sets host, hostaddr or port as a query parameter');
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new DemoRefusedError('DATABASE_URL host is not localhost or 127.0.0.1');
  }
  return { databaseUrl, host: url.hostname, port: url.port === '' ? 5432 : Number(url.port) };
}

/**
 * Builds the environment every demo child process runs with. The forced settings win over the
 * shell, and `ANTHROPIC_API_KEY` is dropped, so the demo can never reach a live model.
 *
 * @param {Record<string, string | undefined>} env - Process environment.
 * @param {string} databaseUrl - The accepted database URL.
 * @returns {Record<string, string>} The child environment.
 */
export function buildDemoEnv(env, databaseUrl) {
  const kept = Object.fromEntries(
    Object.entries(env).filter(
      ([key, value]) => value !== undefined && key !== 'ANTHROPIC_API_KEY',
    ),
  );
  return {
    ...kept,
    ...DEMO_FIXED_ENV,
    DATABASE_URL: databaseUrl,
    API_PORT: String(API_PORT),
    API_BASE_URL: `http://localhost:${API_PORT}`,
    DEV_AUTH_TOKENS: buildDevAuthTokens(),
  };
}

/**
 * Says how to start the local database when it is not reachable.
 *
 * @param {{ host: string, port: number }} target - The database target.
 * @returns {string} A message for the terminal.
 */
export function describeDatabaseDown({ host, port }) {
  return [
    `Postgres is not reachable at ${host}:${port}.`,
    'Start the local database, then run the demo again:',
    '  docker compose -f infra/docker-compose.yml up -d',
  ].join('\n');
}

/**
 * Builds the text printed once the demo is ready.
 *
 * @param {{ cases: number }} state - What the preparation step created.
 * @returns {string} A message for the terminal.
 */
export function describeReady({ cases }) {
  const rows = DEMO_PERSONAS.map(
    (persona) => `  ${persona.token.padEnd(28)} ${persona.role.padEnd(8)} ${persona.shows}`,
  );
  return [
    '',
    'The demo is ready (synthetic data only, no API key).',
    `Sign in at http://localhost:${WEB_PORT}/dev/sign-in with one of these tokens:`,
    ...rows,
    `The advisor queue holds ${cases} open case${cases === 1 ? '' : 's'}.`,
    'Press Ctrl-C to stop. Running `pnpm demo` again resets everything to this state.',
  ].join('\n');
}
