/**
 * @file Acceptance AC45 (planning/13): conversation follows session identity and bounds
 * Placeholder cases until the chat endpoints land; filled in under #518.
 * @requirement FR-01
 * @requirement FR-02
 * @requirement NFR-05
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, it } from 'vitest';

describe('AC45 conversation follows session identity and bounds', () => {
  it.todo(
    'fails identity fields in a tool call against the tool schema and treats a different student plan as NOT_FOUND (#518)',
  );
  it.todo(
    'returns 404 to another student, an advisor or another tenant reading, posting to or clearing a conversation (#518)',
  );
  it.todo('returns 400 when the body carries prior assistant turns (#518)');
  it.todo(
    'sends only the configured number of recent turns to the model, without tool results or blocks (#518)',
  );
  it.todo('deletes older and surplus turns (over 100 turns or 30 days) on the next append (#518)');
  it.todo('logs no message text (#518)');
});
