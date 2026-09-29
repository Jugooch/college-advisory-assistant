/**
 * @file Unit tests for the dev seed command's environment guard.
 */
import { describe, expect, it } from 'vitest';

import { type DevSeedDependencies, runDevSeed, SeedRefusedError } from './dev-seed-command';
import { buildDevSeedPlan } from './dev-seed-plan';

const DEV_SEED_PLAN = buildDevSeedPlan(new Date('2026-10-01T12:00:00.000Z'));

function buildDependencies(env: NodeJS.ProcessEnv): {
  dependencies: DevSeedDependencies;
  openedUrls: string[];
  logged: unknown[];
} {
  const openedUrls: string[] = [];
  const logged: unknown[] = [];
  const dependencies: DevSeedDependencies = {
    env,
    plan: DEV_SEED_PLAN,
    openDatabase: (connectionString) => {
      openedUrls.push(connectionString);
      throw new Error('the database must not be opened in this test');
    },
    logger: { info: (fields) => logged.push(fields) },
  };
  return { dependencies, openedUrls, logged };
}

describe('runDevSeed', () => {
  it('refuses to run when NODE_ENV is production and never opens the database', async () => {
    const { dependencies, openedUrls, logged } = buildDependencies({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://caa:caa@localhost:5432/caa',
    });

    await expect(runDevSeed(dependencies)).rejects.toBeInstanceOf(SeedRefusedError);
    expect(openedUrls).toEqual([]);
    expect(logged).toEqual([]);
  });

  it('fails before opening the database when DATABASE_URL is missing', async () => {
    const { dependencies, openedUrls } = buildDependencies({ NODE_ENV: 'development' });

    await expect(runDevSeed(dependencies)).rejects.toThrow();
    expect(openedUrls).toEqual([]);
  });

  it('opens the configured database when NODE_ENV is development', async () => {
    const { dependencies, openedUrls } = buildDependencies({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://caa:caa@localhost:5432/caa',
    });

    await expect(runDevSeed(dependencies)).rejects.toThrow('must not be opened');
    expect(openedUrls).toEqual(['postgres://caa:caa@localhost:5432/caa']);
  });
});
