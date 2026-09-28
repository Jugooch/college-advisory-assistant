/**
 * @file Tests for the academic summary contract.
 */
import { describe, expect, it } from 'vitest';

import {
  AcademicSummaryResponseSchema,
  getAcademicSummaryEndpoint,
} from './academic-summary.contract';

const PROGRAM_ID = '4d5e6f70-0000-4000-8000-000000000001';
const CORE = {
  sourceRequirementId: 'REQ-CORE',
  parentSourceRequirementId: null,
  label: 'Mathematics core',
  state: 'INCOMPLETE',
  remainingCreditsHundredths: 700,
  remainingCourseCount: 2,
  candidateCourseIds: ['00000000-0000-4000-8000-000000000101'],
  sourceRef: 'REQ-CORE',
};
const CALCULUS = {
  ...CORE,
  sourceRequirementId: 'REQ-CALC',
  parentSourceRequirementId: 'REQ-CORE',
  label: 'Calculus',
  state: 'COMPLETE',
  remainingCreditsHundredths: 0,
  remainingCourseCount: null,
  candidateCourseIds: [],
  sourceRef: 'REQ-CALC',
};
const VALID = {
  student: { id: '2b3c4d5e-0000-4000-8000-000000000001', sourceStudentId: 'DEMO-S-0001' },
  studentSnapshot: {
    id: '3c4d5e6f-0000-4000-8000-000000000001',
    programId: PROGRAM_ID,
    catalogYear: '2025-2026',
    sourceEffectiveAt: '2026-08-20T09:00:00-05:00',
  },
  audit: {
    auditSource: 'demo-audit',
    auditVersion: 'audit_demo_r7',
    programId: PROGRAM_ID,
    catalogYear: '2025-2026',
    generatedAt: '2026-08-21T10:00:00Z',
  },
  auditReflectsRecord: { state: 'PASS', reasonCode: null },
  requirements: [CORE, CALCULUS],
};
const NO_AUDIT = { ...VALID, audit: null, auditReflectsRecord: null, requirements: [] };

/**
 * Returns whether the response schema accepts a payload.
 *
 * @param payload - Candidate response body.
 * @returns `true` when it parses.
 */
const accepts = (payload: unknown): boolean =>
  AcademicSummaryResponseSchema.safeParse(payload).success;

describe('getAcademicSummaryEndpoint', () => {
  it('declares GET /v1/students/:studentId/academic-summary', () => {
    expect(getAcademicSummaryEndpoint).toMatchObject({
      method: 'GET',
      path: '/v1/students/:studentId/academic-summary',
    });
  });
});

describe('AcademicSummaryResponseSchema', () => {
  it('accepts a summary with an audit that reflects the record', () => {
    expect(AcademicSummaryResponseSchema.parse(VALID)).toEqual(VALID);
  });

  it('accepts a stale audit as UNKNOWN with AUDIT_STALE', () => {
    const stale = { state: 'UNKNOWN', reasonCode: 'AUDIT_STALE' };

    expect(accepts({ ...VALID, auditReflectsRecord: stale })).toBe(true);
  });

  it('rejects a reflection that is UNKNOWN without its reason or PASS with one', () => {
    expect(accepts({ ...VALID, auditReflectsRecord: { state: 'UNKNOWN', reasonCode: null } })).toBe(
      false,
    );
    expect(
      accepts({ ...VALID, auditReflectsRecord: { state: 'PASS', reasonCode: 'AUDIT_STALE' } }),
    ).toBe(false);
    expect(
      accepts({ ...VALID, auditReflectsRecord: { state: 'FAIL', reasonCode: 'AUDIT_STALE' } }),
    ).toBe(false);
  });

  it('accepts no audit, with no reflection and no requirements', () => {
    expect(AcademicSummaryResponseSchema.parse(NO_AUDIT).audit).toBeNull();
  });

  it('accepts a record whose program and catalog are unknown', () => {
    const studentSnapshot = { ...VALID.studentSnapshot, programId: null, catalogYear: null };

    expect(accepts({ ...VALID, studentSnapshot })).toBe(true);
  });

  it('rejects a reflection or requirements without an audit', () => {
    expect(accepts({ ...NO_AUDIT, auditReflectsRecord: VALID.auditReflectsRecord })).toBe(false);
    expect(accepts({ ...NO_AUDIT, requirements: VALID.requirements })).toBe(false);
  });

  it('rejects an audit without a reflection or without requirements', () => {
    expect(accepts({ ...VALID, auditReflectsRecord: null })).toBe(false);
    expect(accepts({ ...VALID, requirements: [] })).toBe(false);
  });

  it('rejects a COMPLETE requirement that still needs credits', () => {
    const contradicts = { ...CALCULUS, remainingCreditsHundredths: 300 };

    expect(accepts({ ...VALID, requirements: [CORE, contradicts] })).toBe(false);
  });

  it('rejects a repeated requirement ID or a parent that is not listed', () => {
    const orphan = { ...CALCULUS, parentSourceRequirementId: 'REQ-MISSING' };
    const ownParent = { ...CORE, parentSourceRequirementId: 'REQ-CORE' };

    expect(accepts({ ...VALID, requirements: [CORE, CORE] })).toBe(false);
    expect(accepts({ ...VALID, requirements: [CORE, orphan] })).toBe(false);
    expect(accepts({ ...VALID, requirements: [ownParent] })).toBe(false);
  });

  it('rejects an offset-less timestamp and an unknown requirement state', () => {
    const audit = { ...VALID.audit, generatedAt: '2026-08-21T10:00:00' };
    const guessed = { ...CORE, state: 'PROBABLY_COMPLETE' };

    expect(accepts({ ...VALID, audit })).toBe(false);
    expect(accepts({ ...VALID, requirements: [guessed] })).toBe(false);
  });

  it('strips server-only fields such as tenantId', () => {
    const student = { ...VALID.student, tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f' };

    expect(AcademicSummaryResponseSchema.parse({ ...VALID, student }).student).toEqual(
      VALID.student,
    );
  });
});
