/**
 * @file Runs `scripts/demo.mjs` for real with a database it must refuse: it has to stop before
 * it connects, resets or starts anything.
 * @requirement NFR-05
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../demo.mjs', import.meta.url));

/**
 * Runs the demo script with a minimal environment.
 *
 * @param {Record<string, string>} env - Environment additions.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} The result.
 */
function runDemo(env) {
  return spawnSync(process.execPath, [SCRIPT], {
    env: { PATH: process.env.PATH ?? '', ...env },
    encoding: 'utf8',
    timeout: 20_000,
  });
}

describe('pnpm demo guard', () => {
  it('refuses a non-local database before any write', () => {
    const result = runDemo({ DATABASE_URL: 'postgres://u:p@db.example.com:5432/caa' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing to run the demo');
    expect(result.stderr).not.toContain('db.example.com');
    expect(result.stdout).toBe('');
  });

  it('refuses NODE_ENV=production', () => {
    const result = runDemo({ NODE_ENV: 'production' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('NODE_ENV is production');
  });

  it('says how to start Postgres when nothing listens', () => {
    const result = runDemo({ DATABASE_URL: 'postgres://caa:caa@127.0.0.1:1/caa' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('docker compose -f infra/docker-compose.yml up -d');
  });
});
