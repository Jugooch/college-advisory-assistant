/**
 * @file Tests for the plan revision view: the stored fields, the result, and its freshness.
 */
import { describe, expect, it } from 'vitest';

import { buildRevisionView, CURRENT_FRESHNESS } from '../testing/plan-draft-fixtures';
import {
  buildResponse,
  PHYS_301L,
  PINNED_INPUTS,
  sectionId,
  singleSectionOption,
} from '../testing/schedule-option-fixtures';
import { PlanRevisionViewSchema } from './plan-revision-view.contract';

const accepts = (fields: Record<string, unknown>): boolean =>
  PlanRevisionViewSchema.safeParse(buildRevisionView(fields)).success;

describe('PlanRevisionViewSchema', () => {
  it('accepts a revision with a result and current freshness', () => {
    expect(PlanRevisionViewSchema.safeParse(buildRevisionView()).success).toBe(true);
  });

  it('accepts a stale or unknown revision, returned as history', () => {
    const stale = {
      state: 'STALE',
      reasons: ['AUDIT_SUPERSEDED'],
      checkedAt: '2026-10-08T09:00:00.000-05:00',
    };
    const unknown = {
      state: 'UNKNOWN',
      reasons: ['SOURCE_UNAVAILABLE'],
      checkedAt: '2026-10-08T09:00:00.000-05:00',
    };

    expect(accepts({ freshness: stale })).toBe(true);
    expect(accepts({ freshness: unknown })).toBe(true);
  });

  it('accepts a null result flagged unavailable and rejects either one alone', () => {
    expect(accepts({ result: null, resultUnavailable: true })).toBe(true);
    expect(accepts({ result: null, resultUnavailable: false })).toBe(false);
    expect(accepts({ resultUnavailable: true })).toBe(false);
  });

  it('rejects a result whose outcome differs from the revision outcome', () => {
    expect(accepts({ outcome: 'NEEDS_VERIFICATION', selectedSectionIds: null })).toBe(false);
  });

  it('rejects a result computed from other pinned inputs than the revision', () => {
    const other = { ...PINNED_INPUTS, constraintHash: `sha256:${'0b'.repeat(32)}` };

    expect(accepts({ result: buildResponse({ pinnedInputs: other }) })).toBe(false);
    expect(
      accepts({
        result: buildResponse({
          pinnedInputs: {
            ...PINNED_INPUTS,
            sectionSnapshotId: '5a7b0000-0000-4000-8000-000000000002',
          },
        }),
      }),
    ).toBe(false);
    expect(
      accepts({
        result: buildResponse({ pinnedInputs: { ...PINNED_INPUTS, rulesetVersion: 'other' } }),
      }),
    ).toBe(false);
  });

  it.each([
    ['studentSnapshotId', '3c4d5e6f-0000-4000-8000-000000000002'],
    ['studentRecordEffectiveAt', '2026-09-21T07:30:00.000-05:00'],
    ['auditRecordEffectiveAt', '2026-09-21T07:15:00.000-05:00'],
    ['auditSource', 'other-audit'],
    ['auditVersion', 'audit_demo_r8'],
    ['rulesetVersion', 'other'],
    ['sectionSnapshotId', '5a7b0000-0000-4000-8000-000000000002'],
    ['campusTransitionVersion', null],
    ['solverWorkCap', 2_000_000],
    ['constraintHash', `sha256:${'0b'.repeat(32)}`],
  ])('rejects a result whose pinned %s differs', (key, value) => {
    expect(
      accepts({ result: buildResponse({ pinnedInputs: { ...PINNED_INPUTS, [key]: value } }) }),
    ).toBe(false);
  });

  it('rejects a result for other courses than the revision', () => {
    expect(accepts({ result: buildResponse({ courseIds: [PHYS_301L] }) })).toBe(false);
  });

  it('rejects a selection that is not one of the result options', () => {
    expect(accepts({ selectedSectionIds: [sectionId(99)] })).toBe(false);
    expect(accepts({ selectedSectionIds: [sectionId(2)] })).toBe(false);
  });

  it('accepts a selection equal to the second option', () => {
    expect(
      accepts({
        selectedSectionIds: [sectionId(2)],
        result: buildResponse({ options: [singleSectionOption(1, 1), singleSectionOption(2, 2)] }),
      }),
    ).toBe(true);
  });

  it('keeps the stored revision rules: a selection needs OPTIONS_FOUND', () => {
    expect(accepts({ selectedSectionIds: null })).toBe(false);
    expect(accepts({ selectedSectionIds: [sectionId(2), sectionId(1)] })).toBe(false);
  });

  it('rejects an invalid freshness and a missing freshness', () => {
    expect(accepts({ freshness: { ...CURRENT_FRESHNESS, reasons: ['SOURCE_EXPIRED'] } })).toBe(
      false,
    );
    expect(accepts({ freshness: undefined })).toBe(false);
  });

  it('rejects an extra field such as a registration status', () => {
    expect(accepts({ registered: true })).toBe(false);
  });
});
