/**
 * @file Tests for reading the case preview handoff query.
 */
import { describe, expect, it } from 'vitest';

import { CaseReason, DiscrepancySubject } from '@caa/domain';

import { readHandoffRevision, readPlanReasonQuery, readSubjectQuery } from './handoff-query';

describe('handoff query', () => {
  it('reads a plan reason and defaults anything else to a plan review', () => {
    expect(readPlanReasonQuery('NEEDS_VERIFICATION')).toBe(CaseReason.NeedsVerification);
    expect(readPlanReasonQuery('SOURCE_DISCREPANCY')).toBe(CaseReason.PlanReview);
    expect(readPlanReasonQuery(undefined)).toBe(CaseReason.PlanReview);
  });

  it('reads only an earlier revision made of digits', () => {
    expect(readHandoffRevision('2', 3)).toBe(2);
    expect(readHandoffRevision('3', 3)).toBeNull();
    expect(readHandoffRevision('../1', 3)).toBeNull();
    expect(readHandoffRevision(['1', '2'], 3)).toBeNull();
  });

  it('reads a known subject and defaults otherwise', () => {
    expect(readSubjectQuery('SECTION')).toBe(DiscrepancySubject.Section);
    expect(readSubjectQuery('nope')).toBe(DiscrepancySubject.ProgramOrCatalog);
  });
});
