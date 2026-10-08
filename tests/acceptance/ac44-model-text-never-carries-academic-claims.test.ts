/**
 * @file Acceptance AC44 (planning/13): model text never carries academic claims
 * Placeholder cases until the chat endpoints land; filled in under #518.
 * @requirement FR-10
 * @requirement NFR-05
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, it } from 'vitest';

describe('AC44 model text never carries academic claims', () => {
  it.todo(
    'replaces text stating credits, grade, eligibility, deadline, readiness or registered with a template intro and marks the turn GUARDED (#518)',
  );
  it.todo('replaces text over the length cap rather than truncating it (#518)');
  it.todo('delivers CONDITIONAL and UNKNOWN checks unchanged, never as PASS (#518)');
  it.todo('renders no block without a tool result or detector behind it (#518)');
});
