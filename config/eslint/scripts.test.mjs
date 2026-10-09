/**
 * @file Tests that root `scripts/**` import only the workspace edges ADR-0016 Amendment 1 allows.
 * @see docs/adr/0016-browser-end-to-end-tests-and-local-demo.md
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  LINT_CONFIG_LOAD_TIMEOUT_MS,
  lintWithRules,
  loadRepoLintConfig,
} from './lint-test-harness.mjs';

beforeAll(loadRepoLintConfig, LINT_CONFIG_LOAD_TIMEOUT_MS);

describe('root scripts workspace imports (ADR-0016 Amendment 1)', () => {
  const RULES = ['no-restricted-imports'];
  const SCRIPT = 'scripts/demo-prepare.mjs';
  const TEST = 'scripts/lib/demo.test.mjs';
  const CONTRACT = "import { thing } from '@caa/api-contract';";
  const DB_TESTING = "import { buildDemoSeedPlan } from '@caa/db/testing';";

  it('lets a script and a script test import the api-contract root entry', async () => {
    expect(await lintWithRules(SCRIPT, CONTRACT, RULES)).toEqual([]);
    expect(await lintWithRules(TEST, CONTRACT, RULES)).toEqual([]);
  });

  it('lets a script and a script test import the @caa/db root entry (the reset guard)', async () => {
    const code = "import { assertResetAllowed } from '@caa/db';";

    expect(await lintWithRules(SCRIPT, code, RULES)).toEqual([]);
    expect(await lintWithRules(TEST, code, RULES)).toEqual([]);
  });

  it('lets a script test import @caa/db/testing', async () => {
    expect(await lintWithRules(TEST, DB_TESTING, RULES)).toEqual([]);
  });

  it('forbids a non-test script from importing @caa/db/testing', async () => {
    const messages = await lintWithRules('scripts/lib/demo.mjs', DB_TESTING, RULES);

    expect(messages.join('\n')).not.toEqual('');
  });

  it.each([
    "import { x } from '@caa/engine';",
    "import { x } from '@caa/domain';",
    "import { x } from '@caa/db/src/index';",
    "import { x } from '@caa/api/testing';",
    "import { x } from '@caa/api-contract/src/index';",
    "import { x } from '../packages/api-contract/src/index.ts';",
  ])('forbids %s in scripts and script tests', async (code) => {
    for (const path of [SCRIPT, TEST]) {
      const messages = await lintWithRules(path, code, RULES);

      expect(messages.join('\n')).not.toEqual('');
    }
  });
});
