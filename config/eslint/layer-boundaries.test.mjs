/**
 * @file Tests that the merged lint config keeps the `./testing` entry points test-only and blocks
 * cross-app imports, including subpaths, and keeps Node built-ins out of engine production code,
 * whichever flat-config block matches a file last. Also covers the api `.logic.ts` role (ADR-0008).
 * @see docs/standards/01-repository-structure.md
 * @see docs/standards/05-api-design.md
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { lintImport, lintWithRules, loadRepoLintConfig } from './lint-test-harness.mjs';

beforeAll(loadRepoLintConfig, 120_000);

const PRODUCTION_FILES = [
  'apps/api/src/app.ts',
  'apps/api/src/modules/health/health.controller.ts',
  'apps/api/src/modules/health/health.service.ts',
  'apps/api/src/modules/health/health.routes.ts',
  'apps/api/src/testing/fixtures.ts',
  'apps/worker/src/main.ts',
  'apps/web/src/app/page.tsx',
  'apps/web/src/components/ui/button.tsx',
  'packages/domain/src/models/student.model.ts',
  'packages/engine/src/verification/verify.ts',
  'packages/api-contract/src/index.ts',
  'packages/db/src/client.ts',
  'packages/assistant/src/index.ts',
  'packages/test-kit/src/index.ts',
];

describe('test-only ./testing entry points', () => {
  it.each(PRODUCTION_FILES)('forbids @caa/*/testing in %s', async (path) => {
    for (const specifier of ['@caa/api/testing', '@caa/worker/testing', '@caa/db/testing']) {
      const messages = await lintImport(path, specifier);

      expect(messages.join('\n')).toContain('for tests only');
    }
  });

  it.each([
    'apps/api/src/modules/health/health.service.test.ts',
    'apps/worker/src/jobs/import-roster.job.integration.test.ts',
    'apps/web/src/components/ui/button.test.tsx',
    'packages/test-kit/src/builders.test.ts',
    'tests/acceptance/ac01-plan-next-term.test.ts',
    'tests/support/api-harness.ts',
  ])('allows @caa/*/testing in %s', async (path) => {
    const messages = await lintImport(path, '@caa/api/testing');

    expect(messages).toEqual([]);
  });

  it('does not restrict the non-testing subpaths of a library package', async () => {
    const messages = await lintImport('apps/api/src/app.ts', '@caa/domain');

    expect(messages).toEqual([]);
  });
});

describe('app boundaries cover subpaths', () => {
  it.each([
    ['apps/api/src/app.ts', '@caa/worker'],
    ['apps/api/src/modules/health/health.service.ts', '@caa/worker/jobs'],
    ['apps/api/src/modules/health/health.controller.ts', '@caa/web/lib'],
    ['apps/web/src/app/page.tsx', '@caa/worker'],
    ['apps/web/src/components/ui/button.tsx', '@caa/api/app'],
    ['apps/worker/src/main.ts', '@caa/api/container'],
    ['packages/test-kit/src/index.ts', '@caa/worker'],
    ['packages/test-kit/src/index.ts', '@caa/worker/jobs'],
    ['packages/test-kit/src/index.ts', '@caa/api/app'],
  ])('forbids %s from importing %s', async (path, specifier) => {
    const messages = await lintImport(path, specifier);

    expect(messages).not.toEqual([]);
  });
});

describe('engine production code has no Node built-ins (NFR-01)', () => {
  const ENGINE_SOURCE = 'packages/engine/src/verification/example.ts';

  it.each(['node:fs', 'fs', 'fs/promises', 'node:fs/promises', 'crypto', 'node:test', 'path'])(
    'forbids %s in engine production code',
    async (specifier) => {
      const messages = await lintImport(ENGINE_SOURCE, specifier);

      expect(messages.join('\n')).toContain('NFR-01');
    },
  );

  it.each(['@caa/domain', 'zod', './domain', './path'])(
    'still allows %s in engine production code',
    async (specifier) => {
      const messages = await lintImport(ENGINE_SOURCE, specifier);

      expect(messages).toEqual([]);
    },
  );

  it('keeps the other engine restrictions', async () => {
    const messages = await lintImport(ENGINE_SOURCE, '@caa/db');

    expect(messages.join('\n')).toContain('depends only on @caa/domain');
  });

  it.each([
    ['packages/engine/src/verification/example.test.ts', 'node:fs'],
    ['packages/engine/src/verification/example.test.ts', 'fs'],
    ['packages/db/src/client.ts', 'node:fs'],
    ['packages/db/src/client.ts', 'fs'],
    ['apps/api/src/app.ts', 'node:crypto'],
    ['apps/worker/src/main.ts', 'node:fs'],
    ['apps/web/src/app/page.tsx', 'path'],
    ['packages/test-kit/src/index.ts', 'node:crypto'],
  ])('allows Node built-ins in %s (%s)', async (path, specifier) => {
    const messages = await lintImport(path, specifier);

    expect(messages).toEqual([]);
  });
});

describe('api .logic.ts files are pure (ADR-0008)', () => {
  const LOGIC = 'apps/api/src/modules/x/x.logic.ts';

  it.each([
    "import { verifyCourseSet } from '@caa/engine';",
    "import { CheckState } from '@caa/domain';",
    "import type { StudentSnapshotRevision } from '@caa/db';",
    "import { DomainError } from '../../shared/domain-errors';",
    "import { isSourceFresh } from '../y/y.logic';",
  ])('allows %s', async (statement) => {
    expect(await lintImport(LOGIC, statement)).toEqual([]);
  });

  it.each([
    "import { createStudentSnapshotRepository } from '@caa/db';",
    "import { fastify } from 'fastify';",
    "import { createYService } from '../y/y.service';",
    "import { requestContext } from '../../shared/request-context';",
    "import { container } from '../../container';",
    "import { loadEnv } from '../../config/env';",
    "import { readFileSync } from 'node:fs';",
    "import { readFileSync } from 'fs';",
    "import { eq } from 'drizzle-orm';",
    "import { x } from '@caa/worker';",
  ])('forbids %s', async (statement) => {
    expect(await lintImport(LOGIC, statement)).not.toEqual([]);
  });

  it('allows parsing a given time', async () => {
    const messages = await lintWithRules(LOGIC, 'export const at = new Date(value);', [
      'no-restricted-properties',
      'no-restricted-syntax',
    ]);

    expect(messages).toEqual([]);
  });

  it.each([
    ['Date.now()', 'NFR-01'],
    ['Math.random()', 'NFR-01'],
    ['new Date()', "service's injected clock"],
  ])('forbids %s', async (expression, message) => {
    const messages = await lintWithRules(LOGIC, `export const x = ${expression};`, [
      'no-restricted-properties',
      'no-restricted-syntax',
    ]);

    expect(messages.join('\n')).toContain(message);
  });

  it('keeps the language syntax bans', async () => {
    const messages = await lintWithRules(LOGIC, 'enum Color { Red }', ['no-restricted-syntax']);

    expect(messages.join('\n')).toContain('as const');
  });

  it.each(['apps/api/src/modules/x/x.controller.ts', 'apps/api/src/modules/x/x.routes.ts'])(
    'forbids %s from importing ./x.logic',
    async (path) => {
      expect(await lintImport(path, "import { decide } from './x.logic';")).not.toEqual([]);
    },
  );

  it('still lets a service import logic', async () => {
    const statement = "import { decide } from './x.logic';";

    expect(await lintImport('apps/api/src/modules/x/x.service.ts', statement)).toEqual([]);
  });
});
