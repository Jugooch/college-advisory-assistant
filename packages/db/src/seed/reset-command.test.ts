/**
 * @file Unit tests for the database reset guard: it must refuse before it connects.
 */
import { describe, expect, it } from 'vitest';

import {
  assertResetAllowed,
  type DevResetDependencies,
  ResetRefusedError,
  runDevReset,
} from './reset-command';

function build(env: NodeJS.ProcessEnv): { dependencies: DevResetDependencies; opened: string[] } {
  const opened: string[] = [];
  return {
    opened,
    dependencies: {
      env,
      openDatabase: (connectionString) => {
        opened.push(connectionString);
        throw new Error('the database must not be used in this test');
      },
      logger: { info: () => undefined },
    },
  };
}

describe('assertResetAllowed', () => {
  it.each(['postgres://caa:caa@localhost:5432/caa', 'postgres://caa:caa@127.0.0.1:5432/caa'])(
    'allows the local database %s',
    (url) => {
      expect(assertResetAllowed({ NODE_ENV: 'development', DATABASE_URL: url })).toBe(url);
    },
  );

  it.each([
    'postgres://caa:caa@db.example.com:5432/caa',
    'postgres://caa:caa@10.0.0.5:5432/caa',
    'postgres://caa:caa@localhost.example.com:5432/caa',
    'postgres://localhost@evil.example.com:5432/caa',
    'not a url',
  ])('refuses %s', (url) => {
    expect(() => assertResetAllowed({ NODE_ENV: 'development', DATABASE_URL: url })).toThrow(
      ResetRefusedError,
    );
  });

  it('refuses NODE_ENV=production even for a local host, and says why', () => {
    expect(() =>
      assertResetAllowed({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://caa:caa@localhost:5432/caa',
      }),
    ).toThrow('NODE_ENV is production');
  });

  it('does not echo the connection string in the refusal', () => {
    try {
      assertResetAllowed({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://caa:secret-pw@db.example.com:5432/caa',
      });
    } catch (error) {
      expect(String(error)).not.toContain('secret-pw');
    }
    expect.assertions(1);
  });
});

describe('runDevReset', () => {
  it('never opens the database when refused', async () => {
    const remote = build({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://x@db.example.com/caa',
    });
    const production = build({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://x@localhost/caa',
    });

    await expect(runDevReset(remote.dependencies)).rejects.toBeInstanceOf(ResetRefusedError);
    await expect(runDevReset(production.dependencies)).rejects.toBeInstanceOf(ResetRefusedError);
    expect([...remote.opened, ...production.opened]).toEqual([]);
  });

  it('opens the local database when allowed', async () => {
    const local = build({ NODE_ENV: 'development', DATABASE_URL: 'postgres://x@localhost/caa' });

    await expect(runDevReset(local.dependencies)).rejects.toThrow('must not be used');
    expect(local.opened).toEqual(['postgres://x@localhost/caa']);
  });
});
