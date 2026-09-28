/**
 * @file Tests for the audit snapshot data object.
 */
import { describe, expect, it } from 'vitest';

import { RequirementState } from '../enums/requirement-state.enum';
import {
  type AuditSnapshotInput,
  AuditSnapshotSchema,
  createAuditSnapshot,
  isSameProgramAndCatalog,
} from './audit-snapshot.model';
import { ProgramIdSchema } from './program.model';
import type { RequirementResultInput } from './requirement-result.model';

const CORE: RequirementResultInput = {
  sourceRequirementId: 'demo.core',
  parentSourceRequirementId: null,
  label: 'Core curriculum',
  state: RequirementState.Incomplete,
  allocatedAttemptIds: [],
  remainingCreditsHundredths: null,
  remainingCourseCount: null,
  candidateCourseIds: [],
  isReusable: false,
  sourceRef: 'audit_demo_r7:item1',
};

const MATH_CORE: RequirementResultInput = {
  sourceRequirementId: 'demo.math.core',
  parentSourceRequirementId: 'demo.core',
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
  parentSourceRequirementId: null,
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
  studentSnapshotId: '8192a3b4-0000-4000-8000-000000000001',
  programId: '708192a3-0000-4000-8000-000000000001',
  auditSource: 'demo-audit',
  auditVersion: 'audit_demo_r7',
  catalogYear: '2025-2026',
  generatedAt: '2026-09-25T07:00:00.000-05:00',
  studentRecordEffectiveAt: '2026-09-25T05:30:00.000-05:00',
  requirements: [CORE, MATH_CORE, WRITING],
};

describe('createAuditSnapshot', () => {
  it('accepts a snapshot with provenance and a requirement tree', () => {
    expect(createAuditSnapshot({ ...VALID, requirements: [CORE, MATH_CORE] })).toEqual({
      id: '6f708192-0000-4000-8000-000000000001',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      studentId: '2b3c4d5e-0000-4000-8000-000000000001',
      studentSnapshotId: '8192a3b4-0000-4000-8000-000000000001',
      programId: '708192a3-0000-4000-8000-000000000001',
      auditSource: 'demo-audit',
      auditVersion: 'audit_demo_r7',
      catalogYear: '2025-2026',
      generatedAt: '2026-09-25T07:00:00.000-05:00',
      studentRecordEffectiveAt: '2026-09-25T05:30:00.000-05:00',
      requirements: [
        {
          sourceRequirementId: 'demo.core',
          parentSourceRequirementId: null,
          label: 'Core curriculum',
          state: 'INCOMPLETE',
          allocatedAttemptIds: [],
          remainingCreditsHundredths: null,
          remainingCourseCount: null,
          candidateCourseIds: [],
          isReusable: false,
          sourceRef: 'audit_demo_r7:item1',
        },
        {
          sourceRequirementId: 'demo.math.core',
          parentSourceRequirementId: 'demo.core',
          label: 'Mathematics core',
          state: 'INCOMPLETE',
          allocatedAttemptIds: ['5e6f7081-0000-4000-8000-000000000001'],
          remainingCreditsHundredths: 350,
          remainingCourseCount: 1,
          candidateCourseIds: ['3c4d5e6f-0000-4000-8000-000000000002'],
          isReusable: false,
          sourceRef: 'audit_demo_r7:item12',
        },
      ],
    });
  });

  it('accepts a child listed before its parent', () => {
    const snapshot = createAuditSnapshot({ ...VALID, requirements: [MATH_CORE, CORE] });

    expect(snapshot.requirements.map((result) => result.sourceRequirementId)).toEqual([
      'demo.math.core',
      'demo.core',
    ]);
  });

  it('accepts a three-level tree', () => {
    const algebra = {
      ...MATH_CORE,
      sourceRequirementId: 'demo.math.algebra',
      parentSourceRequirementId: 'demo.math.core',
    };

    expect(
      createAuditSnapshot({ ...VALID, requirements: [CORE, MATH_CORE, algebra] }).requirements,
    ).toHaveLength(3);
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
        requirements: [CORE, MATH_CORE, { ...WRITING, sourceRequirementId: 'demo.math.core' }],
      }),
    ).toThrow(/sourceRequirementId must be unique/);
  });

  it('rejects a requirement that names itself as its parent', () => {
    expect(() =>
      createAuditSnapshot({
        ...VALID,
        requirements: [{ ...WRITING, parentSourceRequirementId: 'demo.gen.writing' }],
      }),
    ).toThrow(/must refer to another requirement in the snapshot/);
  });

  it('rejects a parent that is not in the snapshot', () => {
    expect(() => createAuditSnapshot({ ...VALID, requirements: [MATH_CORE, WRITING] })).toThrow(
      /must refer to another requirement in the snapshot/,
    );
  });

  it('rejects a two-requirement cycle', () => {
    expect(() =>
      createAuditSnapshot({
        ...VALID,
        requirements: [{ ...CORE, parentSourceRequirementId: 'demo.math.core' }, MATH_CORE],
      }),
    ).toThrow(/must not form a cycle/);
  });

  it('rejects a longer cycle below a valid root', () => {
    const a = { ...MATH_CORE, sourceRequirementId: 'demo.a', parentSourceRequirementId: 'demo.c' };
    const b = { ...MATH_CORE, sourceRequirementId: 'demo.b', parentSourceRequirementId: 'demo.a' };
    const c = { ...MATH_CORE, sourceRequirementId: 'demo.c', parentSourceRequirementId: 'demo.b' };

    expect(() => createAuditSnapshot({ ...VALID, requirements: [CORE, a, b, c] })).toThrow(
      /must not form a cycle/,
    );
  });

  it('rejects an empty auditSource', () => {
    expect(() => createAuditSnapshot({ ...VALID, auditSource: '' })).toThrow();
  });

  it('rejects an empty auditVersion', () => {
    expect(() => createAuditSnapshot({ ...VALID, auditVersion: '' })).toThrow();
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
    const result = AuditSnapshotSchema.safeParse({ ...VALID, requirements: [WRITING, WRITING] });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['requirements']]);
  });

  it('rejects an omitted studentSnapshotId, because the audited record must be pinned', () => {
    const { studentSnapshotId: omitted, ...withoutSnapshot } = VALID;

    expect(omitted).toBe('8192a3b4-0000-4000-8000-000000000001');
    expect(
      AuditSnapshotSchema.safeParse(withoutSnapshot).error?.issues.map((issue) => issue.path),
    ).toEqual([['studentSnapshotId']]);
  });

  it('rejects a studentSnapshotId that is not a UUID', () => {
    expect(AuditSnapshotSchema.safeParse({ ...VALID, studentSnapshotId: 'r7' }).success).toBe(
      false,
    );
  });

  it('rejects an omitted auditVersion, because provenance is required', () => {
    const { auditVersion: omitted, ...withoutVersion } = VALID;

    expect(omitted).toBe('audit_demo_r7');
    expect(AuditSnapshotSchema.safeParse(withoutVersion).success).toBe(false);
  });
});

describe('isSameProgramAndCatalog', () => {
  const MATH = ProgramIdSchema.parse('4d5e6f70-0000-4000-8000-000000000001');
  const PHYSICS = ProgramIdSchema.parse('4d5e6f70-0000-4000-8000-000000000002');

  it.each([
    { record: 'the same program and catalog', programId: MATH, catalogYear: '2025-2026', is: true },
    { record: 'a different program', programId: PHYSICS, catalogYear: '2025-2026', is: false },
    { record: 'a different catalog', programId: MATH, catalogYear: '2024-2025', is: false },
    { record: 'no program', programId: null, catalogYear: '2025-2026', is: false },
    { record: 'no catalog', programId: MATH, catalogYear: null, is: false },
  ])('given a record with $record, returns $is', ({ programId, catalogYear, is }) => {
    const audit = { programId: MATH, catalogYear: '2025-2026' };

    expect(isSameProgramAndCatalog({ programId, catalogYear }, audit)).toBe(is);
  });
});
