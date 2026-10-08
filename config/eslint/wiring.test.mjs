/**
 * @file Tests that only the composition root imports `.wiring.ts` files and that wiring files stay
 * construction-only (ADR-0014).
 * @see docs/adr/0014-api-composition-root-wiring-files.md
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  LINT_CONFIG_LOAD_TIMEOUT_MS,
  lintWithRules,
  loadRepoLintConfig,
} from './lint-test-harness.mjs';

beforeAll(loadRepoLintConfig, LINT_CONFIG_LOAD_TIMEOUT_MS);

describe('api composition-root wiring files (ADR-0014)', () => {
  const WIRING = 'apps/api/src/wiring/plans.wiring.ts';
  const RULES = ['no-restricted-imports', '@typescript-eslint/no-restricted-imports'];
  const WIRING_IMPORT = "import { wirePlans } from './wiring/plans.wiring';";

  it('lets container.ts import a wiring file', async () => {
    expect(await lintWithRules('apps/api/src/container.ts', WIRING_IMPORT, RULES)).toEqual([]);
  });

  it('lets a wiring test import its wiring file', async () => {
    const path = 'apps/api/src/wiring/plans.wiring.test.ts';

    expect(await lintWithRules(path, "import { wirePlans } from './plans.wiring';", RULES)).toEqual(
      [],
    );
  });

  it.each([
    'apps/api/src/app.ts',
    'apps/api/src/plugins/auth.plugin.ts',
    'apps/api/src/modules/plans/plans.service.ts',
    'apps/api/src/modules/plans/plans.controller.ts',
    'apps/api/src/modules/plans/plans.routes.ts',
    'apps/api/src/modules/plans/plans.logic.ts',
  ])('forbids %s from importing a wiring file', async (path) => {
    const messages = await lintWithRules(path, WIRING_IMPORT, RULES);

    expect(messages.join('\n')).not.toEqual('');
  });

  it.each([
    "import { wireOther } from './other.wiring';",
    "import { registerPlans } from '../modules/plans/plans.routes';",
    "import { authPlugin } from '../plugins/auth.plugin';",
    "import { buildApp } from '../app';",
    "import { start } from '../server';",
    "import { fastify } from 'fastify';",
    "import { eq } from 'drizzle-orm';",
    "import { Pool } from 'pg';",
    "import { createContainer } from '../container';",
    "import { createPlanRepository } from '@caa/db';",
    "import { x } from '@caa/web';",
  ])('forbids a wiring file from using %s', async (statement) => {
    expect(await lintWithRules(WIRING, statement, RULES)).not.toEqual([]);
  });

  it.each([
    "import type { Repositories } from '../container';",
    "import { type Repositories } from '../container';",
    "import type { PlanRepository } from '@caa/db';",
    "import { createPlansService } from '../modules/plans/plans.service';",
    "import { createPlansController } from '../modules/plans/plans.controller';",
    "import { PlanSchema } from '@caa/domain';",
  ])('lets a wiring file use %s', async (statement) => {
    expect(await lintWithRules(WIRING, statement, RULES)).toEqual([]);
  });

  it.each([
    'export const at = new Date();',
    'export const at = Date.now();',
    'export const url = process.env.URL;',
    'export const n = Math.random();',
  ])('bans clock and environment reads in a wiring file: %s', async (code) => {
    const names = ['no-restricted-properties', 'no-restricted-globals', 'no-restricted-syntax'];

    expect(await lintWithRules(WIRING, code, names)).not.toEqual([]);
  });
});
