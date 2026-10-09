/**
 * @file Tests for requirement state wording and the needs-verification rule.
 */
import { describe, expect, it } from 'vitest';

import { CheckState, ReasonCode, RequirementState } from '@caa/domain';

import { describeRequirementState, isStandingUnverified } from './requirement-state-wording';

const GENERATED_AT = '2026-09-10T09:00:00Z';
const PASS = { state: CheckState.Pass, reasonCode: null } as const;

describe('isStandingUnverified', () => {
  it('is false when both verdicts pass', () => {
    expect(
      isStandingUnverified({ auditReflectsRecord: PASS, programCatalogConsistency: PASS }),
    ).toBe(false);
  });

  it.each([ReasonCode.AuditStale, ReasonCode.AuditAmbiguous])(
    'is true when the audit reflects-record verdict is UNKNOWN (%s)',
    (reasonCode) => {
      expect(
        isStandingUnverified({
          auditReflectsRecord: { state: CheckState.Unknown, reasonCode },
          programCatalogConsistency: PASS,
        }),
      ).toBe(true);
    },
  );

  it('is true when the program and catalog verdict is UNKNOWN', () => {
    expect(
      isStandingUnverified({
        auditReflectsRecord: PASS,
        programCatalogConsistency: {
          state: CheckState.Unknown,
          reasonCode: ReasonCode.AuditProgramMismatch,
        },
      }),
    ).toBe(true);
  });
});

describe('describeRequirementState', () => {
  it('shows COMPLETE as complete as of the audit time', () => {
    expect(
      describeRequirementState(RequirementState.Complete, {
        auditGeneratedAt: GENERATED_AT,
        isUnverified: false,
      }),
    ).toEqual({
      label: 'Complete as of Sep 10, 2026, 9:00 AM UTC',
      tone: 'positive',
      explanation: null,
    });
  });

  it('shows AMBIGUOUS as needing verification with a caution tone', () => {
    expect(
      describeRequirementState(RequirementState.Ambiguous, {
        auditGeneratedAt: GENERATED_AT,
        isUnverified: false,
      }),
    ).toMatchObject({
      label: 'Needs verification as of Sep 10, 2026, 9:00 AM UTC',
      tone: 'caution',
    });
  });

  it('shows IN_PROGRESS as conditional on current courses, never as complete', () => {
    expect(
      describeRequirementState(RequirementState.InProgress, {
        auditGeneratedAt: GENERATED_AT,
        isUnverified: false,
      }),
    ).toEqual({
      label: 'In progress as of Sep 10, 2026, 9:00 AM UTC',
      tone: 'caution',
      explanation: 'Complete only if your current courses finish with the required grades.',
    });
  });

  it.each(Object.values(RequirementState))(
    'shows %s as needing verification, not current standing, when unverified',
    (state) => {
      const display = describeRequirementState(state, {
        auditGeneratedAt: GENERATED_AT,
        isUnverified: true,
      });

      expect(display.label).toMatch(/^Needs verification: audit showed .+ as of Sep 10, 2026/);
      expect(display.tone).toBe('caution');
    },
  );
});
