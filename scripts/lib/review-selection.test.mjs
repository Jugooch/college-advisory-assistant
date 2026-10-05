/**
 * @file Tests reviewer selection per pull request type.
 * @module scripts/lib/review-selection.test
 */
import { describe, expect, it } from 'vitest';

import { selectReviewers } from './review-selection.mjs';

const CORE = [
  'architecture-reviewer',
  'standards-reviewer',
  'correctness-reviewer',
  'security-reviewer',
];

describe('selectReviewers', () => {
  it('gives docs-only changes architecture and standards', () => {
    expect(selectReviewers(['docs/planning/07.md', 'CLAUDE.md'])).toEqual([
      'architecture-reviewer',
      'standards-reviewer',
    ]);
  });

  it('gives test-only changes correctness, standards and academic-safety', () => {
    const expected = ['standards-reviewer', 'correctness-reviewer', 'academic-safety-reviewer'];
    expect(selectReviewers(['tests/acceptance/a.test.ts'])).toEqual(expected);
    expect(selectReviewers(['packages/test-kit/src/x.ts'])).toEqual(expected);
    expect(selectReviewers(['apps/web/src/a.test.tsx', 'docs/x.md'])).toEqual(expected);
  });

  it('keeps the full panel when a test change comes with source, config or scripts', () => {
    expect(selectReviewers(['packages/engine/src/a.test.ts', 'packages/engine/src/a.ts'])).toEqual([
      ...CORE,
      'academic-safety-reviewer',
    ]);
    expect(selectReviewers(['scripts/a.test.mjs'])).toEqual(CORE);
    expect(selectReviewers(['tests/a.test.ts', 'package.json'])).toContain('security-reviewer');
  });

  it('never drops academic-safety for domain, engine, api, db or tests', () => {
    for (const path of [
      'packages/domain/src/a.ts',
      'packages/engine/src/a.ts',
      'apps/api/src/a.ts',
      'packages/db/src/a.ts',
      'tests/a.ts',
    ]) {
      expect(selectReviewers([path])).toContain('academic-safety-reviewer');
    }
  });

  it('never drops security for api, auth, workflows, scripts or dependencies', () => {
    for (const path of [
      'apps/api/src/a.ts',
      'apps/api/src/auth/a.ts',
      '.github/workflows/ci.yml',
      'scripts/a.mjs',
      'package.json',
      'pnpm-lock.yaml',
    ]) {
      expect(selectReviewers([path])).toContain('security-reviewer');
    }
  });

  it('adds accessibility only for web UI files', () => {
    expect(selectReviewers(['apps/web/src/components/a.tsx'])).toContain('accessibility-reviewer');
    expect(selectReviewers(['apps/web/src/app/a.css'])).toContain('accessibility-reviewer');
    expect(selectReviewers(['apps/web/src/api/client.ts'])).not.toContain('accessibility-reviewer');
    expect(selectReviewers(['apps/web/README.md'])).not.toContain('accessibility-reviewer');
    expect(selectReviewers(['apps/api/src/a.ts'])).not.toContain('accessibility-reviewer');
  });

  it('treats an empty change as the full core panel', () => {
    expect(selectReviewers([])).toEqual(CORE);
  });
});
