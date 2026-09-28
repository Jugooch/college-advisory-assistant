/**
 * @file Test configuration for the web app: server-rendered component tests in Node, with the
 * automatic JSX runtime and the `@/` source alias.
 * @see docs/standards/07-testing.md
 */
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { name: 'apps/web', environment: 'node' },
});
