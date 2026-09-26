/**
 * @file Bundles the API for production. Workspace packages are compiled into the bundle.
 */
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  noExternal: [/^@caa\//],
  clean: true,
  sourcemap: true,
});
