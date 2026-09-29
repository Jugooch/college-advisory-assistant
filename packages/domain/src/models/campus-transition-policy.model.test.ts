/**
 * @file Tests for the campus transition policy.
 */
import { describe, expect, it } from 'vitest';

import {
  type CampusTransitionPolicyInput,
  CampusTransitionPolicySchema,
  createCampusTransitionPolicy,
} from './campus-transition-policy.model';

const TENANT_ID = '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f';
const NORTH_CAMPUS_ID = 'c4a1b2c3-0000-4000-8000-000000000001';
const SOUTH_CAMPUS_ID = 'c4a1b2c3-0000-4000-8000-000000000002';

const POLICY: CampusTransitionPolicyInput = {
  tenantId: TENANT_ID,
  version: 'demo-2026.1',
  transitions: [
    { fromCampusId: NORTH_CAMPUS_ID, toCampusId: SOUTH_CAMPUS_ID, minutes: 30 },
    { fromCampusId: SOUTH_CAMPUS_ID, toCampusId: NORTH_CAMPUS_ID, minutes: 40 },
  ],
};

describe('createCampusTransitionPolicy', () => {
  it('accepts asymmetric ordered pairs of different campuses', () => {
    expect(createCampusTransitionPolicy(POLICY)).toEqual({
      tenantId: TENANT_ID,
      version: 'demo-2026.1',
      transitions: [
        { fromCampusId: NORTH_CAMPUS_ID, toCampusId: SOUTH_CAMPUS_ID, minutes: 30 },
        { fromCampusId: SOUTH_CAMPUS_ID, toCampusId: NORTH_CAMPUS_ID, minutes: 40 },
      ],
    });
  });

  it('accepts a zero-minute pair, which the institution must state explicitly', () => {
    const transitions = [
      { fromCampusId: NORTH_CAMPUS_ID, toCampusId: SOUTH_CAMPUS_ID, minutes: 0 },
    ];

    expect(createCampusTransitionPolicy({ ...POLICY, transitions }).transitions[0]?.minutes).toBe(
      0,
    );
  });

  it('accepts an empty table, which leaves every pair of different campuses unknown', () => {
    expect(createCampusTransitionPolicy({ ...POLICY, transitions: [] }).transitions).toEqual([]);
  });

  it('rejects a same-campus pair, because the same campus needs no transition', () => {
    expect(() =>
      createCampusTransitionPolicy({
        ...POLICY,
        transitions: [{ fromCampusId: NORTH_CAMPUS_ID, toCampusId: NORTH_CAMPUS_ID, minutes: 0 }],
      }),
    ).toThrow(/must be different campuses/);
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

  it('rejects an empty version', () => {
    expect(() => createCampusTransitionPolicy({ ...POLICY, version: '' })).toThrow();
  });
});

describe('CampusTransitionPolicySchema', () => {
  it('reports a same-campus pair on its toCampusId field', () => {
    const result = CampusTransitionPolicySchema.safeParse({
      ...POLICY,
      transitions: [{ fromCampusId: SOUTH_CAMPUS_ID, toCampusId: SOUTH_CAMPUS_ID, minutes: 5 }],
    });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ['transitions', 0, 'toCampusId'],
    ]);
  });
});
