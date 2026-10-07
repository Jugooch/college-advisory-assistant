/**
 * @file Unit tests for the dev revise command's guards and flag parsing.
 */
import { describe, expect, it } from 'vitest';

import { SeedRefusedError } from './dev-seed-command';
import {
  type DevReviseDependencies,
  parseReviseTarget,
  ReviseUsageError,
  runDevRevise,
} from './revise-command';

const URL_ENV = 'postgres://caa:caa@localhost:5432/caa';

function buildDependencies(
  env: NodeJS.ProcessEnv,
  argv: readonly string[] = [],
): { dependencies: DevReviseDependencies; openedUrls: string[] } {
  const openedUrls: string[] = [];
  return {
    openedUrls,
    dependencies: {
      env,
      argv,
      now: new Date('2026-10-07T12:00:00.000Z'),
      openDatabase: (connectionString) => {
        openedUrls.push(connectionString);
        throw new Error('the database must not be used in this test');
      },
      logger: { info: () => undefined },
    },
  };
}

describe('runDevRevise', () => {
  it('refuses to run when NODE_ENV is production and never opens the database', async () => {
    const { dependencies, openedUrls } = buildDependencies({
      NODE_ENV: 'production',
      DATABASE_URL: URL_ENV,
    });

    await expect(runDevRevise(dependencies)).rejects.toBeInstanceOf(SeedRefusedError);
    expect(openedUrls).toEqual([]);
  });

  it('refuses production before it even looks at the arguments', async () => {
    const { dependencies } = buildDependencies({ NODE_ENV: 'production' }, ['--bogus']);

    await expect(runDevRevise(dependencies)).rejects.toBeInstanceOf(SeedRefusedError);
  });

  it('fails before opening the database on a bad argument or a missing DATABASE_URL', async () => {
    const badArgument = buildDependencies({ NODE_ENV: 'development', DATABASE_URL: URL_ENV }, [
      '--drop',
    ]);
    const noUrl = buildDependencies({ NODE_ENV: 'development' });

    await expect(runDevRevise(badArgument.dependencies)).rejects.toBeInstanceOf(ReviseUsageError);
    await expect(runDevRevise(noUrl.dependencies)).rejects.toThrow();
    expect([...badArgument.openedUrls, ...noUrl.openedUrls]).toEqual([]);
  });

  it('opens the configured database in development', async () => {
    const { dependencies, openedUrls } = buildDependencies({
      NODE_ENV: 'development',
      DATABASE_URL: URL_ENV,
    });

    await expect(runDevRevise(dependencies)).rejects.toThrow('must not be used');
    expect(openedUrls).toEqual([URL_ENV]);
  });
});

describe('parseReviseTarget', () => {
  it('defaults to the student record and reads --student and --sections', () => {
    expect(parseReviseTarget([])).toBe('student');
    expect(parseReviseTarget(['--student'])).toBe('student');
    expect(parseReviseTarget(['--sections'])).toBe('sections');
  });

  it('rejects both flags together and anything unknown', () => {
    expect(() => parseReviseTarget(['--student', '--sections'])).toThrow(ReviseUsageError);
    expect(() => parseReviseTarget(['sections'])).toThrow(ReviseUsageError);
  });
});
