/**
 * @file Tests that no CI workflow references the model API key, so CI never calls a live model
 * (ADR-0015 §9) and the model-boundary tests run on fakes.
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const WORKFLOWS = fileURLToPath(new URL('../../.github/workflows', import.meta.url));
const FORBIDDEN_SECRET = /secrets\.ANTHROPIC_API_KEY|^\s*ANTHROPIC_API_KEY\s*:/m;

describe('workflow secrets', () => {
  it('never pass ANTHROPIC_API_KEY to a job', () => {
    const files = readdirSync(WORKFLOWS).filter((name) => /\.ya?ml$/.test(name));
    const offenders = files.filter((name) =>
      FORBIDDEN_SECRET.test(readFileSync(join(WORKFLOWS, name), 'utf8')),
    );

    expect(files.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('detects the key when a workflow passes it', () => {
    expect(FORBIDDEN_SECRET.test('env:\n  ANTHROPIC_API_KEY: x')).toBe(true);
    expect(FORBIDDEN_SECRET.test('k: ${{ secrets.ANTHROPIC_API_KEY }}')).toBe(true);
    expect(FORBIDDEN_SECRET.test('# CI must never receive ANTHROPIC_API_KEY.')).toBe(false);
  });
});
