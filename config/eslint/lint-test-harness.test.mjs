/**
 * @file Tests that the lint-config test harness loads the repository ESLint config once and
 * shares it, so slow checkouts pay the plugin-import cost once per worker (#80).
 * @see docs/standards/07-testing.md
 */
import { describe, expect, it } from 'vitest';

import {
  LINT_CONFIG_LOAD_TIMEOUT_MS,
  lintWithRules,
  loadRepoLintConfig,
} from './lint-test-harness.mjs';

describe('loadRepoLintConfig', () => {
  it(
    'shares one load between concurrent and later calls',
    async () => {
      const first = loadRepoLintConfig();
      const concurrent = loadRepoLintConfig();
      await first;

      expect(concurrent).toBe(first);
      expect(loadRepoLintConfig()).toBe(first);
    },
    LINT_CONFIG_LOAD_TIMEOUT_MS,
  );

  it('lints with the loaded config', async () => {
    await loadRepoLintConfig();

    const messages = await lintWithRules('packages/engine/src/x.ts', 'Date.now();', [
      'no-restricted-properties',
    ]);

    expect(messages.join('\n')).toContain('NFR-01');
  });
});
