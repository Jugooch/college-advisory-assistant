/**
 * @file Acceptance AC43 (planning/13): chat constraints apply only when confirmed
 * Placeholder cases until the chat endpoints land; filled in under #517.
 * @requirement FR-16
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, it } from 'vitest';

describe('AC43 chat constraints apply only when confirmed', () => {
  it.todo(
    'shows a no-Fridays proposal as a preferred, unconfirmed chip and applies nothing (#517)',
  );
  it.todo('computes options before confirming on the form state alone (#517)');
  it.todo(
    'holds the constraint in the form with the student-chosen strength after confirming, and options honour it (#517)',
  );
  it.todo(
    'proves no plan, rather than relaxing, when a hard Friday exclusion leaves no section for a Friday-only course (#517)',
  );
});
