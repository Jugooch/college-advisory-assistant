/**
 * @file Tests for the campus transition policy.
 */
import { describe, expect, it } from 'vitest';

import {
  type CampusTransitionPolicyInput,
  createCampusTransitionPolicy,
} from './campus-transition-policy.model';

const TENANT_ID = '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f';
const NORTH_CAMPUS_ID = 'c4a1b2c3-0000-4000-8000-000000000001';
const SOUTH_CAMPUS_ID = 'c4a1b2c3-0000-4000-8000-000000000002';

const POLICY: CampusTransitionPolicyInput = {
  tenantId: TENANT_ID,
  rulesetVersion: 'demo-2026.1',
  transitions: [
    { fromCampusId: NORTH_CAMPUS_ID, toCampusId: SOUTH_CAMPUS_ID, minutes: 30 },
    { fromCampusId: SOUTH_CAMPUS_ID, toCampusId: NORTH_CAMPUS_ID, minutes: 40 },
    { fromCampusId: NORTH_CAMPUS_ID, toCampusId: NORTH_CAMPUS_ID, minutes: 0 },
  ],
};

describe('createCampusTransitionPolicy', () => {
  it('accepts asymmetric ordered pairs and a same-campus pair of zero minutes', () => {
    expect(createCampusTransitionPolicy(POLICY).transitions).toEqual([
      { fromCampusId: NORTH_CAMPUS_ID, toCampusId: SOUTH_CAMPUS_ID, minutes: 30 },
      { fromCampusId: SOUTH_CAMPUS_ID, toCampusId: NORTH_CAMPUS_ID, minutes: 40 },
      { fromCampusId: NORTH_CAMPUS_ID, toCampusId: NORTH_CAMPUS_ID, minutes: 0 },
    ]);
  });

  it('accepts an empty policy, which leaves every pair unknown', () => {
    expect(createCampusTransitionPolicy({ ...POLICY, transitions: [] }).transitions).toEqual([]);
  });

  it('rejects a repeated ordered pair', () => {
    expect(() =>
      createCampusTransitionPolicy({
        ...POLICY,
        transitions: [
          { fromCampusId: NORTH_CAMPUS_ID, toCampusId: SOUTH_CAMPUS_ID, minutes: 30 },
          { fromCampusId: NORTH_CAMPUS_ID, toCampusId: SOUTH_CAMPUS_ID, minutes: 10 },
        ],
      }),
    ).toThrow(/Each ordered campus pair may appear at most once/);
  });

  it.each([-1, 12.5])('rejects %j minutes', (minutes) => {
    expect(() =>
      createCampusTransitionPolicy({
        ...POLICY,
        transitions: [{ fromCampusId: NORTH_CAMPUS_ID, toCampusId: SOUTH_CAMPUS_ID, minutes }],
      }),
    ).toThrow();
  });

  it('rejects an empty ruleset version', () => {
    expect(() => createCampusTransitionPolicy({ ...POLICY, rulesetVersion: '' })).toThrow();
  });
});
