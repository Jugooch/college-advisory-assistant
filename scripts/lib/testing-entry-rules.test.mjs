/**
 * @file Tests the `./testing` export allowlist (standard 01 §Test entry points, ADR-0009).
 * @see docs/adr/0009-test-entry-points-allowlist.md
 */
import { describe, expect, it } from 'vitest';

import { checkTestingExport, TESTING_ENTRY_WORKSPACES } from './testing-entry-rules.mjs';

const TESTING = { './testing': './src/testing.ts' };

describe('checkTestingExport', () => {
  it.each(TESTING_ENTRY_WORKSPACES)('allows %s to export ./testing', (workspace) => {
    expect(checkTestingExport(`${workspace}/package.json`, { exports: TESTING })).toBeNull();
  });

  it('allows a conditional ./testing entry whose targets are all src/testing.ts', () => {
    const exports = {
      '.': './src/index.ts',
      './testing': { types: './src/testing.ts', import: './src/testing.ts' },
    };

    expect(checkTestingExport('packages/db/package.json', { exports })).toBeNull();
  });

  it.each([
    ['no exports', {}],
    ['a string export', { exports: './src/index.ts' }],
    ['only a main entry', { exports: { '.': './src/index.ts' } }],
    ['a similar but different key', { exports: { './testing-kit': './src/kit.ts' } }],
  ])('ignores a package with %s', (_name, manifest) => {
    expect(checkTestingExport('packages/engine/package.json', manifest)).toBeNull();
  });

  it.each([
    'packages/engine/package.json',
    'packages/domain/package.json',
    'packages/test-kit/package.json',
    'apps/web/package.json',
    'package.json',
    'tests/package.json',
    'apps/api/nested/package.json',
  ])('rejects ./testing in %s', (path) => {
    expect(checkTestingExport(path, { exports: TESTING })).toContain('may export ./testing');
  });

  it.each([
    ['another file', './src/test-support.ts'],
    ['a nested index', './src/testing/index.ts'],
    ['the production entry', './src/index.ts'],
    ['a condition pointing elsewhere', { types: './src/testing.ts', import: './dist/testing.js' }],
    ['a non-string target', null],
  ])('rejects an allowed workspace pointing at %s', (_name, target) => {
    const manifest = { exports: { './testing': target } };

    expect(checkTestingExport('apps/api/package.json', manifest)).toContain('src/testing.ts only');
  });

  it.each(['./testing/fixtures', './testing.js'])(
    'rejects the extra test-support key %s in an allowed workspace',
    (key) => {
      const manifest = { exports: { ...TESTING, [key]: './src/testing.ts' } };

      expect(checkTestingExport('apps/worker/package.json', manifest)).toContain(key);
    },
  );
});
