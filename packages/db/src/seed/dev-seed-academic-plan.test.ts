/**
 * @file Unit tests for the academic dev seed plan builder: the literal inputs each documented
 *   scenario relies on, for a fixed run time. Expected results are not computed here; they come
 *   from the golden corpus.
 */
import { describe, expect, it } from 'vitest';

import { isSameProgramAndCatalog, RequirementState } from '@caa/domain';

import { buildDevSeedAcademicPlan } from './dev-seed-academic-plan';

const CURRENT_STUDENT = '30000000-0000-4000-8000-000000000001';
const STALE_STUDENT = '30000000-0000-4000-8000-000000000002';
/** The fixed run time; 1790856000000 ms, `01a0f755f200` in hex. */
const NOW = new Date('2026-10-01T12:00:00.000Z');
const PLAN = buildDevSeedAcademicPlan(NOW);

const courseByLabel = (label: string) => PLAN.courses.find((course) => course.label === label);
const snapshotsOf = (studentId: string) =>
  PLAN.snapshots.filter((snapshot) => snapshot.studentId === studentId);
const auditOf = (studentId: string) => PLAN.audits.find((audit) => audit.studentId === studentId);

describe('buildDevSeedAcademicPlan', () => {
  it('builds the same plan from the same run time', () => {
    expect(buildDevSeedAcademicPlan(new Date('2026-10-01T12:00:00.000Z'))).toEqual(PLAN);
  });

  it("times SYN-000001's record 3 hours before the run, and its audit on that record", () => {
    const [snapshot] = snapshotsOf(CURRENT_STUDENT);
    const audit = auditOf(CURRENT_STUDENT);

    expect(snapshotsOf(CURRENT_STUDENT)).toHaveLength(1);
    expect(snapshot).toMatchObject({
      id: 'a0000000-0001-4000-8000-01a0f755f200',
      sourceEffectiveAt: '2026-10-01T09:00:00.000Z',
      ingestedAt: '2026-10-01T10:00:00.000Z',
    });
    expect(audit).toMatchObject({
      id: '70000000-0001-4000-8000-01a0f755f200',
      studentSnapshotId: 'a0000000-0001-4000-8000-01a0f755f200',
      auditVersion: 'audit_demo_r1_1790856000000',
      generatedAt: '2026-10-01T11:00:00.000Z',
      studentRecordEffectiveAt: '2026-10-01T09:00:00.000Z',
    });
    expect(audit?.requirements.map((requirement) => requirement.sourceRef)).toEqual([
      'requirement/REQ-DEMO-BS',
      'requirement/REQ-MATH-CORE',
      'requirement/REQ-PHYS-SEQ',
      'requirement/REQ-ELECTIVES',
    ]);
    expect(snapshot && audit && isSameProgramAndCatalog(snapshot, audit)).toBe(true);
  });

  it("pins SYN-000002's audit to a record 17 days older than its latest record", () => {
    const audit = auditOf(STALE_STUDENT);

    expect(snapshotsOf(STALE_STUDENT)).toEqual([
      expect.objectContaining({
        id: 'a0000000-0002-4000-8000-01a0f755f200',
        sourceEffectiveAt: '2026-09-14T09:00:00.000Z',
        ingestedAt: '2026-09-14T10:00:00.000Z',
        attemptIds: [],
      }),
      expect.objectContaining({
        id: 'a0000000-0003-4000-8000-01a0f755f200',
        sourceEffectiveAt: '2026-10-01T09:00:00.000Z',
        ingestedAt: '2026-10-01T10:00:00.000Z',
      }),
    ]);
    expect(audit).toMatchObject({
      id: '70000000-0002-4000-8000-01a0f755f200',
      studentSnapshotId: 'a0000000-0002-4000-8000-01a0f755f200',
      auditVersion: 'audit_demo_r2_1790856000000',
      generatedAt: '2026-09-14T11:00:00.000Z',
      studentRecordEffectiveAt: '2026-09-14T09:00:00.000Z',
    });
  });

  it('gives a later run new snapshot and audit IDs and versions, and the same attempts', () => {
    const later = buildDevSeedAcademicPlan(new Date('2026-10-02T12:00:00.000Z'));

    expect(later.snapshots.map((snapshot) => snapshot.id)).toEqual([
      'a0000000-0001-4000-8000-01a0fc7c4e00',
      'a0000000-0002-4000-8000-01a0fc7c4e00',
      'a0000000-0003-4000-8000-01a0fc7c4e00',
    ]);
    expect(later.audits.map((audit) => audit.auditVersion)).toEqual([
      'audit_demo_r1_1790942400000',
      'audit_demo_r2_1790942400000',
    ]);
    expect(later.attempts).toEqual(PLAN.attempts);
  });

  it('refuses an invalid run time', () => {
    expect(() => buildDevSeedAcademicPlan(new Date('not a date'))).toThrow(RangeError);
  });

  it('uses only DEMO- course codes', () => {
    const codes = PLAN.courses.flatMap((course) => [course.label, course.sourceCourseId]);

    expect(codes.every((code) => code.startsWith('DEMO-'))).toBe(true);
  });

  it('holds the GC-REP-001 repeat: DEMO-MATH 101 with D in 2025FA, then B in 2026SP', () => {
    const math101 = courseByLabel('DEMO-MATH 101');

    const attempts = PLAN.attempts
      .filter(
        (attempt) => attempt.studentId === CURRENT_STUDENT && attempt.courseId === math101?.id,
      )
      .map(({ termCode, status, grade }) => ({ termCode, status, grade }));

    expect(attempts).toEqual([
      { termCode: '2025FA', status: 'COMPLETED', grade: { scheme: 'LETTER', value: 'D' } },
      { termCode: '2026SP', status: 'COMPLETED', grade: { scheme: 'LETTER', value: 'B' } },
    ]);
  });

  it('holds DEMO-PHYS 201 in progress for the current student', () => {
    const phys201 = courseByLabel('DEMO-PHYS 201');

    const attempt = PLAN.attempts.find((candidate) => candidate.courseId === phys201?.id);

    expect(attempt).toMatchObject({
      studentId: CURRENT_STUDENT,
      status: 'IN_PROGRESS',
      grade: null,
    });
  });

  it('prices the credit-load scenario like the golden TEN_CREDITS set, plus a lab and DEMO-IND 390', () => {
    const credits = ['DEMO-MATH 102', 'DEMO-PHYS 301', 'DEMO-ENGL 101', 'DEMO-PHYS 301L'].map(
      (label) => courseByLabel(label)?.creditsHundredths,
    );
    const ind390 = courseByLabel('DEMO-IND 390');

    expect(credits).toEqual([300, 400, 300, 100]);
    expect([ind390?.minCreditsHundredths, ind390?.maxCreditsHundredths]).toEqual([100, 300]);
  });

  it('states the policy the scenarios assume, including credit bounds', () => {
    expect(PLAN.policy).toMatchObject({
      allowsInProgressPrerequisites: true,
      repeatPolicy: 'MOST_RECENT',
      termCreditBounds: { minCreditsHundredths: 1200, maxCreditsHundredths: 1800 },
    });
  });

  it('orders terms by sequence and includes the planning term 2027SP', () => {
    expect(PLAN.terms.map((term) => [term.termCode, term.sequence])).toEqual([
      ['2025FA', 1],
      ['2026SP', 2],
      ['2026FA', 3],
      ['2027SP', 4],
    ]);
  });

  it('gives the current audit COMPLETE, IN_PROGRESS, and INCOMPLETE requirements', () => {
    const states = new Set(auditOf(CURRENT_STUDENT)?.requirements.map((result) => result.state));

    expect(states).toEqual(
      new Set([
        RequirementState.Complete,
        RequirementState.InProgress,
        RequirementState.Incomplete,
      ]),
    );
  });
});
