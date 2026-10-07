/**
 * @file Tests for the prerequisite check of a course with no rule in the pinned ruleset.
 */
import { describe, expect, it } from 'vitest';

import { missingPrerequisiteRuleCheck } from './missing-prerequisite-rule';

describe('missingPrerequisiteRuleCheck', () => {
  it('is UNKNOWN PREREQUISITE_RULE_MISSING with the pinned ruleset and no source', () => {
    expect(missingPrerequisiteRuleCheck('demo-2026.1')).toEqual({
      kind: 'PREREQUISITE',
      state: 'UNKNOWN',
      reasonCode: 'PREREQUISITE_RULE_MISSING',
      evidence: { rulesetVersion: 'demo-2026.1', decisiveLeaves: [] },
    });
  });

  it('carries the ruleset version it is given', () => {
    expect(missingPrerequisiteRuleCheck('demo-2025.2').evidence).toEqual({
      rulesetVersion: 'demo-2025.2',
      decisiveLeaves: [],
    });
  });

  it('is never PASS and has no source reference', () => {
    const check = missingPrerequisiteRuleCheck('demo-2026.1');

    expect(check.state).not.toBe('PASS');
    expect(check).not.toHaveProperty('sourceRef');
  });

  it('returns a deep-equal result when called twice with the same input (NFR-01)', () => {
    expect(missingPrerequisiteRuleCheck('demo-2026.1')).toEqual(
      missingPrerequisiteRuleCheck('demo-2026.1'),
    );
  });
});
