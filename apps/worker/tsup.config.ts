/**
 * @file Bundles the worker for production. Workspace packages are compiled into the bundle.
 */
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  noExternal: [/^@caa\//],
  clean: true,
  sourcemap: true,
});
