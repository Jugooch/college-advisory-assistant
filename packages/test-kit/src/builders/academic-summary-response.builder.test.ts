/**
 * @file Tests for the synthetic academic summary response builder.
 */
import { describe, expect, it } from 'vitest';

import { AcademicSummaryResponseSchema } from '@caa/api-contract';

import { buildAcademicSummaryResponse } from './academic-summary-response.builder';

describe('buildAcademicSummaryResponse', () => {
  it('defaults to a passing audit with one incomplete requirement', () => {
    const summary = buildAcademicSummaryResponse();

    expect(AcademicSummaryResponseSchema.safeParse(summary).success).toBe(true);
    expect(summary.auditReflectsRecord).toEqual({ state: 'PASS', reasonCode: null });
    expect(summary.requirements).toHaveLength(1);
  });

  it('accepts a summary with no audit', () => {
    const summary = buildAcademicSummaryResponse({
      audit: null,
      auditReflectsRecord: null,
      programCatalogConsistency: null,
      requirements: [],
    });

    expect(summary.audit).toBeNull();
  });

  it('rejects an audit with no verdict', () => {
    expect(() => buildAcademicSummaryResponse({ auditReflectsRecord: null })).toThrow();
  });
});
