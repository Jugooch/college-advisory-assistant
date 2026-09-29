/**
 * @file Tests for the synthetic campus transition policy builders.
 */
import { describe, expect, it } from 'vitest';

import { CampusTransitionPolicySchema } from '@caa/domain';

import {
  buildCampusTransition,
  buildCampusTransitionPolicy,
} from './campus-transition-policy.builder';

const NORTH_CAMPUS_ID = 'd0000000-0000-4000-8000-000000000001';
const SOUTH_CAMPUS_ID = 'd0000000-0000-4000-8000-000000000002';

describe('buildCampusTransition', () => {
  it('builds the ordered pair and minutes it is given', () => {
    expect(buildCampusTransition(NORTH_CAMPUS_ID, SOUTH_CAMPUS_ID, 20)).toEqual({
      fromCampusId: NORTH_CAMPUS_ID,
      toCampusId: SOUTH_CAMPUS_ID,
      minutes: 20,
    });
  });

  it('accepts an explicit zero-minute pair', () => {
    expect(buildCampusTransition(SOUTH_CAMPUS_ID, NORTH_CAMPUS_ID, 0).minutes).toBe(0);
  });

  it('rejects a same-campus pair', () => {
    expect(() => buildCampusTransition(NORTH_CAMPUS_ID, NORTH_CAMPUS_ID, 0)).toThrow();
  });

  it('rejects negative or fractional minutes', () => {
    expect(() => buildCampusTransition(NORTH_CAMPUS_ID, SOUTH_CAMPUS_ID, -1)).toThrow();
    expect(() => buildCampusTransition(NORTH_CAMPUS_ID, SOUTH_CAMPUS_ID, 7.5)).toThrow();
  });
});

describe('buildCampusTransitionPolicy', () => {
  it('defaults to an empty demo-2026.1 table of tenant A, which leaves every pair unknown', () => {
    expect(buildCampusTransitionPolicy()).toEqual({
      tenantId: '10000000-0000-4000-8000-000000000001',
      version: 'demo-2026.1',
      transitions: [],
    });
  });

  it('holds asymmetric pairs in the order given', () => {
    const policy = buildCampusTransitionPolicy({
      transitions: [
        buildCampusTransition(NORTH_CAMPUS_ID, SOUTH_CAMPUS_ID, 20),
        buildCampusTransition(SOUTH_CAMPUS_ID, NORTH_CAMPUS_ID, 25),
      ],
    });

    expect(policy.transitions.map((pair) => pair.minutes)).toEqual([20, 25]);
  });

  it('returns deep-equal policies for the same arguments', () => {
    expect(buildCampusTransitionPolicy({ version: 'demo-2026.2' })).toEqual(
      buildCampusTransitionPolicy({ version: 'demo-2026.2' }),
    );
  });

  it('returns a policy that passes the domain schema', () => {
    expect(CampusTransitionPolicySchema.safeParse(buildCampusTransitionPolicy()).success).toBe(
      true,
    );
  });

  it('rejects a repeated ordered pair', () => {
    expect(() =>
      buildCampusTransitionPolicy({
        transitions: [
          buildCampusTransition(NORTH_CAMPUS_ID, SOUTH_CAMPUS_ID, 20),
          buildCampusTransition(NORTH_CAMPUS_ID, SOUTH_CAMPUS_ID, 30),
        ],
      }),
    ).toThrow();
  });
});
