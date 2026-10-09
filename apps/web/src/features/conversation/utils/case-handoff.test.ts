/**
 * @file Tests for the case preview's link to the existing case forms.
 */
import { describe, expect, it } from 'vitest';

import { CaseReason, DiscrepancySubject } from '@caa/domain';
import { buildCasePreviewBlock, syntheticId } from '@caa/test-kit';

import { caseHandoffHref, type CasePreview } from './case-handoff';

const STUDENT_ID = syntheticId('student', 1);

describe('caseHandoffHref', () => {
  it('opens the plan form with the plan, revision and reason, and no note', () => {
    const block = buildCasePreviewBlock({ planRevision: 2 }) as CasePreview;
    const url = new URL(caseHandoffHref(block, STUDENT_ID), 'http://localhost');
    expect(url.pathname).toBe('/ask-an-advisor');
    expect(url.searchParams.get('planId')).toBe(syntheticId('plan', 1));
    expect(url.searchParams.get('revision')).toBe('2');
    expect(url.searchParams.get('reason')).toBe(CaseReason.PlanReview);
    expect([...url.searchParams.keys()].sort()).toEqual([
      'planId',
      'reason',
      'revision',
      'studentId',
    ]);
  });

  it('opens the problem report with its subject for a source discrepancy', () => {
    const block = buildCasePreviewBlock({
      reason: CaseReason.SourceDiscrepancy,
      planId: null,
      planRevision: null,
      discrepancySubject: DiscrepancySubject.Section,
    }) as CasePreview;
    const url = new URL(caseHandoffHref(block, STUDENT_ID), 'http://localhost');
    expect(url.pathname).toBe('/report-a-problem');
    expect(url.searchParams.get('subject')).toBe('SECTION');
  });
});
