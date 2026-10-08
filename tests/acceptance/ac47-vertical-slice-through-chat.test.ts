/**
 * @file Acceptance AC47 (planning/13): the first vertical slice through chat (planning/14)
 * Placeholder cases until the chat endpoints land; filled in under #520.
 * @requirement FR-08
 * @requirement FR-10
 * @requirement FR-12
 * @requirement FR-16
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, it } from 'vitest';

describe('AC47 the first vertical slice through chat (planning/14)', () => {
  it.todo('step 1: next-term options with no Fridays gives a preferred, unconfirmed chip (#520)');
  it.todo(
    'step 2: confirming it as hard and asking again gives two options with evidence from the schedule-options service (#520)',
  );
  it.todo(
    'step 3: a policy question gives an approved excerpt with its revision and effective dates (#520)',
  );
  it.todo('step 4: a financial-aid question gives the referral with no determination (#520)');
  it.todo('step 5: ask my advisor gives a case preview and no case exists (#520)');
  it.todo(
    'step 6: creating the case through the existing endpoint pins the revision and the case has no transcript (#520)',
  );
  it.todo('runs the same story with the demo model (#505) (#520)');
});
