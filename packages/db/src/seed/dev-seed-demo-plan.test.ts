/**
 * @file Unit tests for the demo seed plan.
 */
import { describe, expect, it } from 'vitest';

import { AttemptStatus } from '@caa/domain';

import { SEED_CATALOG } from './dev-seed-academic-catalog';
import { buildDemoSeedPlan } from './dev-seed-demo-plan';
import { buildDevSeedPlan } from './dev-seed-plan';
import { seedRecordTimes } from './dev-seed-record-times';

const NOW = new Date('2026-10-01T12:00:00.000Z');

describe('buildDemoSeedPlan', () => {
  it('gives the same plan for the same run time', () => {
    expect(buildDemoSeedPlan(NOW)).toEqual(buildDemoSeedPlan(new Date(NOW)));
  });

  it('contains the whole dev seed plan, unchanged', () => {
    const dev = buildDevSeedPlan(NOW);
    const demo = buildDemoSeedPlan(NOW);

    expect(demo.identities.slice(0, dev.identities.length)).toEqual(dev.identities);
    expect(demo.students.slice(0, dev.students.length)).toEqual(dev.students);
    expect(demo.assignments.slice(0, dev.assignments.length)).toEqual(dev.assignments);
    expect(demo.academic.attempts.slice(0, dev.academic.attempts.length)).toEqual(
      dev.academic.attempts,
    );
    expect(demo.academic.audits.slice(0, dev.academic.audits.length)).toEqual(dev.academic.audits);
    expect(demo.sections).toEqual(dev.sections);
    expect(demo.policyDocuments).toEqual(dev.policyDocuments);
  });

  it('adds three personas, each signing in and assigned to synthetic-advisor-001', () => {
    const dev = buildDevSeedPlan(NOW);
    const demo = buildDemoSeedPlan(NOW);
    const added = demo.students.slice(dev.students.length);

    expect(added.map((student) => student.sourceStudentId)).toEqual([
      'SYN-000004',
      'SYN-000005',
      'SYN-000006',
    ]);
    expect(added.map((student) => student.userSubject)).toEqual([
      'synthetic-student-004',
      'synthetic-student-005',
      'synthetic-student-006',
    ]);
    const subjects = new Set(demo.identities.map((identity) => identity.subject));
    expect(added.every((student) => subjects.has(student.userSubject ?? ''))).toBe(true);
    const assigned = demo.assignments
      .filter((assignment) => assignment.advisorSubject === 'synthetic-advisor-001')
      .map((assignment) => assignment.sourceStudentId);
    expect(assigned).toEqual(expect.arrayContaining(added.map((s) => s.sourceStudentId)));
  });

  it('gives the blocked persona a below-C grade and the unknown persona a pending transfer', () => {
    const demo = buildDemoSeedPlan(NOW);
    const added = demo.academic.attempts.slice(4, 7);

    expect(added.map((attempt) => attempt.status)).toEqual([
      AttemptStatus.Completed,
      AttemptStatus.TransferPending,
      AttemptStatus.Completed,
    ]);
    expect(added[0]?.grade).toMatchObject({ value: 'D' });
    expect(added[1]?.grade).toBeNull();
  });

  it('gives each persona one current snapshot holding its attempts', () => {
    const demo = buildDemoSeedPlan(NOW);
    const snapshots = demo.academic.snapshots.slice(3);

    expect(snapshots.map((snapshot) => snapshot.studentId)).toEqual([
      '30000000-0000-4000-8000-000000000004',
      '30000000-0000-4000-8000-000000000005',
      '30000000-0000-4000-8000-000000000006',
    ]);
    expect(snapshots.map((snapshot) => snapshot.attemptIds)).toEqual([
      ['60000000-0000-4000-8000-000000000104'],
      ['60000000-0000-4000-8000-000000000105'],
      ['60000000-0000-4000-8000-000000000106', '60000000-0000-4000-8000-000000000206'],
    ]);
  });

  it('gives SYN-000006 a completed PHYS 201 with a passing grade before 2027SP', () => {
    const attempts = buildDemoSeedPlan(NOW).academic.attempts;
    const phys = attempts.find((attempt) => attempt.id === '60000000-0000-4000-8000-000000000206');

    expect(phys).toMatchObject({
      studentId: '30000000-0000-4000-8000-000000000006',
      courseId: SEED_CATALOG.phys201.id,
      status: AttemptStatus.Completed,
      grade: { scheme: 'LETTER', value: 'C' },
      creditsEarnedHundredths: 400,
      termCode: '2026FA',
    });
    expect(attempts).toHaveLength(8);
  });

  it('writes one audit per persona, pinned to its current snapshot', () => {
    const dev = buildDevSeedPlan(NOW);
    const demo = buildDemoSeedPlan(NOW);
    const added = demo.academic.audits.slice(dev.academic.audits.length);
    const snapshots = demo.academic.snapshots.slice(dev.academic.snapshots.length);
    const times = seedRecordTimes(NOW);

    expect(demo.academic.audits.slice(0, 2)).toEqual(dev.academic.audits);
    expect(added).toHaveLength(3);
    expect(added.map((audit) => audit.studentId)).toEqual(snapshots.map((s) => s.studentId));
    for (const [index, audit] of added.entries()) {
      expect(audit).toMatchObject({
        tenantId: snapshots[index]?.tenantId,
        programId: snapshots[index]?.programId,
        catalogYear: snapshots[index]?.catalogYear,
        studentSnapshotId: snapshots[index]?.id,
        studentRecordEffectiveAt: times.currentRecordEffectiveAt,
        generatedAt: times.currentAuditGeneratedAt,
      });
    }
  });

  it('keeps audit IDs and versions apart from the dev seed and decides no persona state', () => {
    const demo = buildDemoSeedPlan(NOW);
    const ids = demo.academic.audits.map((audit) => audit.id);
    const versions = demo.academic.audits.map((audit) => audit.auditVersion);

    expect(new Set(ids).size).toBe(5);
    expect(new Set(versions).size).toBe(5);
    for (const audit of demo.academic.audits.slice(2)) {
      expect(audit.requirements.map((req) => req.state)).toEqual(['INCOMPLETE']);
      expect(audit.requirements.flatMap((req) => req.allocatedAttemptIds)).toEqual([]);
    }
  });

  it('uses only visibly synthetic subjects, IDs and issuer', () => {
    const demo = buildDemoSeedPlan(NOW);

    for (const identity of demo.identities) {
      expect(identity.subject).toMatch(/^synthetic-(student|advisor|admin)-\d{3}$/);
      expect(identity.issuer).toContain('synthetic');
    }
    for (const student of demo.students) {
      expect(student.sourceStudentId).toMatch(/^SYN-\d{6}$/);
    }
  });

  it('rejects an invalid run time', () => {
    expect(() => buildDemoSeedPlan(new Date(Number.NaN))).toThrow(RangeError);
  });
});
