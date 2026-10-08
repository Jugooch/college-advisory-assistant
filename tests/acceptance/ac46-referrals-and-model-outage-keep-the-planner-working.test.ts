/**
 * @file Acceptance AC46 (planning/13): referrals and model outage keep the planner working
 * Placeholder cases until the chat endpoints land; filled in under #518.
 * @requirement FR-10
 * @requirement FR-14
 * @requirement NFR-05
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, it } from 'vitest';

describe('AC46 referrals and model outage keep the planner working', () => {
  it.todo(
    'answers financial aid, crisis, assume-I-passed, ignore-a-prerequisite and wrong-grade messages with fixed templates and no determination (#518)',
  );
  it.todo('makes no model call for crisis language and states chat is not monitored live (#518)');
  it.todo('shows the stale-source notice when a tool source is stale (#518)');
  it.todo(
    'returns 200 with the matching modelStatus and a form pointer for outage, timeout, budget, chat off and rate limit (#518)',
  );
  it.todo(
    'keeps the planner form, schedule options, drafts and cases working with the model off and down (#518)',
  );
});
