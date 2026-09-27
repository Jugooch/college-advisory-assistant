/**
 * @file Tests for the audit snapshot data object.
 */
import { describe, expect, it } from 'vitest';

import { RequirementState } from '../enums/requirement-state.enum';
import {
  type AuditSnapshotInput,
  AuditSnapshotSchema,
  createAuditSnapshot,
} from './audit-snapshot.model';
import type { RequirementResultInput } from './requirement-result.model';

const MATH_CORE: RequirementResultInput = {
  sourceRequirementId: 'demo.math.core',
  label: 'Mathematics core',
  state: RequirementState.Incomplete,
  allocatedAttemptIds: ['5e6f7081-0000-4000-8000-000000000001'],
  remainingCreditsHundredths: 350,
  remainingCourseCount: 1,
  candidateCourseIds: ['3c4d5e6f-0000-4000-8000-000000000002'],
  isReusable: false,
  sourceRef: 'audit_demo_r7:item12',
};

const WRITING: RequirementResultInput = {
  sourceRequirementId: 'demo.gen.writing',
  label: 'Writing intensive',
  state: RequirementState.Complete,
  allocatedAttemptIds: ['5e6f7081-0000-4000-8000-000000000002'],
  remainingCreditsHundredths: null,
  remainingCourseCount: 0,
  candidateCourseIds: [],
  isReusable: true,
  sourceRef: 'audit_demo_r7:item3',
};

const VALID: AuditSnapshotInput = {
  id: '6f708192-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  studentId: '2b3c4d5e-0000-4000-8000-000000000001',
  programId: '708192a3-0000-4000-8000-000000000001',
  catalogYear: '2025-2026',
  generatedAt: '2026-09-25T07:00:00.000-05:00',
  studentRecordEffectiveAt: '2026-09-25T05:30:00.000-05:00',
  requirements: [MATH_CORE, WRITING],
};

describe('createAuditSnapshot', () => {
  it('accepts a snapshot with distinct requirements', () => {
    expect(createAuditSnapshot(VALID)).toEqual({
      id: '6f708192-0000-4000-8000-000000000001',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      studentId: '2b3c4d5e-0000-4000-8000-000000000001',
      programId: '708192a3-0000-4000-8000-000000000001',
      catalogYear: '2025-2026',
      generatedAt: '2026-09-25T07:00:00.000-05:00',
      studentRecordEffectiveAt: '2026-09-25T05:30:00.000-05:00',
      requirements: [
        {
          sourceRequirementId: 'demo.math.core',
          label: 'Mathematics core',
          state: 'INCOMPLETE',
          allocatedAttemptIds: ['5e6f7081-0000-4000-8000-000000000001'],
          remainingCreditsHundredths: 350,
          remainingCourseCount: 1,
          candidateCourseIds: ['3c4d5e6f-0000-4000-8000-000000000002'],
          isReusable: false,
          sourceRef: 'audit_demo_r7:item12',
        },
        {
          sourceRequirementId: 'demo.gen.writing',
          label: 'Writing intensive',
          state: 'COMPLETE',
          allocatedAttemptIds: ['5e6f7081-0000-4000-8000-000000000002'],
          remainingCreditsHundredths: null,
          remainingCourseCount: 0,
          candidateCourseIds: [],
          isReusable: true,
          sourceRef: 'audit_demo_r7:item3',
        },
      ],
    });
  });

  it('accepts a record time equal to the generation time', () => {
    const snapshot = createAuditSnapshot({
      ...VALID,
      studentRecordEffectiveAt: '2026-09-25T07:00:00.000-05:00',
    });

    expect(snapshot.studentRecordEffectiveAt).toBe('2026-09-25T07:00:00.000-05:00');
  });

  it('compares times as instants when the offsets differ', () => {
    // 11:30Z is 06:30-05:00, which is before generatedAt (07:00-05:00), although it sorts later.
    const snapshot = createAuditSnapshot({
      ...VALID,
      studentRecordEffectiveAt: '2026-09-25T11:30:00.000Z',
    });

    expect(snapshot.studentRecordEffectiveAt).toBe('2026-09-25T11:30:00.000Z');
  });

  it('rejects a record time after the generation time, even when it sorts earlier', () => {
    // 07:30-05:00 is 12:30Z, after generatedAt (12:00Z), although the string sorts earlier.
    expect(() =>
      createAuditSnapshot({
        ...VALID,
        generatedAt: '2026-09-25T12:00:00.000Z',
        studentRecordEffectiveAt: '2026-09-25T07:30:00.000-05:00',
      }),
    ).toThrow(/must not be later than generatedAt/);
  });

  it('rejects a repeated sourceRequirementId', () => {
    expect(() =>
      createAuditSnapshot({
        ...VALID,
        requirements: [MATH_CORE, { ...WRITING, sourceRequirementId: 'demo.math.core' }],
      }),
    ).toThrow(/sourceRequirementId must be unique/);
  });

  it('rejects a snapshot with no requirements', () => {
    expect(() => createAuditSnapshot({ ...VALID, requirements: [] })).toThrow();
  });

  it('rejects a snapshot containing an invalid requirement', () => {
    expect(() =>
      createAuditSnapshot({
        ...VALID,
        requirements: [{ ...WRITING, remainingCourseCount: 2 }],
      }),
    ).toThrow(/COMPLETE requirement must not have a remaining quantity/);
  });

  it('rejects a generatedAt without an offset', () => {
    expect(() => createAuditSnapshot({ ...VALID, generatedAt: '2026-09-25T07:00:00' })).toThrow();
  });

  it('rejects an empty catalogYear', () => {
    expect(() => createAuditSnapshot({ ...VALID, catalogYear: '' })).toThrow();
  });

  it('rejects a programId that is not a UUID', () => {
    expect(() => createAuditSnapshot({ ...VALID, programId: 'BS-MATH' })).toThrow();
  });
});

describe('AuditSnapshotSchema', () => {
  it('reports a duplicate requirement on the requirements field', () => {
    const result = AuditSnapshotSchema.safeParse({
      ...VALID,
      requirements: [MATH_CORE, MATH_CORE],
    });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['requirements']]);
  });
});
