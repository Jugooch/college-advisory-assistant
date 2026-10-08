/**
 * @file Acceptance AC42 (planning/13): approved policy search applies tenant, audience and effective-date filters
 * Placeholder cases until the chat endpoints land; filled in under #517.
 * @requirement FR-08
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, it } from 'vitest';

describe('AC42 approved policy search applies tenant, audience and effective-date filters', () => {
  it.todo(
    'returns only approved revisions effective at the instant for the student audience and tenant, highest revision per document (#517)',
  );
  it.todo('excludes a revision whose effectiveTo equals the instant (#517)');
  it.todo('gives identical ranked results for identical queries (#517)');
  it.todo('shows a conflict notice on both documents of a disagreeing pair (#517)');
  it.todo(
    'shows injected policy text as quoted policy and changes no tool call, block or access decision (#517)',
  );
});
