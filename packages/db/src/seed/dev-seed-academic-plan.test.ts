/**
 * @file Unit tests for the academic dev seed plan: the literal inputs each documented scenario
 *   relies on. Expected results are not computed here; they come from the golden corpus.
 */
import { describe, expect, it } from 'vitest';

import { isSameProgramAndCatalog, RequirementState } from '@caa/domain';

import { DEV_SEED_ACADEMIC_PLAN as PLAN, SEED_RECORD_TIMES } from './dev-seed-academic-plan';

const CURRENT_STUDENT = '30000000-0000-4000-8000-000000000001';
const STALE_STUDENT = '30000000-0000-4000-8000-000000000002';
const SEVENTEEN_DAYS_MS = 17 * 24 * 60 * 60 * 1000;

const courseByLabel = (label: string) => PLAN.courses.find((course) => course.label === label);
const snapshotsOf = (studentId: string) =>
  PLAN.snapshots.filter((snapshot) => snapshot.studentId === studentId);
const auditOf = (studentId: string) => PLAN.audits.find((audit) => audit.studentId === studentId);

describe('DEV_SEED_ACADEMIC_PLAN', () => {
  it('uses only DEMO- course codes', () => {
    const codes = PLAN.courses.flatMap((course) => [course.label, course.sourceCourseId]);

    expect(codes.every((code) => code.startsWith('DEMO-'))).toBe(true);
  });

  it("pins the current student's audit to that student's snapshot, with no skew", () => {
    const [snapshot] = snapshotsOf(CURRENT_STUDENT);
    const audit = auditOf(CURRENT_STUDENT);

    expect(snapshotsOf(CURRENT_STUDENT)).toHaveLength(1);
    expect(audit?.studentSnapshotId).toBe(snapshot?.id);
    expect(audit?.studentRecordEffectiveAt).toBe(snapshot?.sourceEffectiveAt);
    expect(snapshot && audit && isSameProgramAndCatalog(snapshot, audit)).toBe(true);
  });

  it("pins the stale student's audit to a snapshot 17 days older than the latest", () => {
    const snapshots = snapshotsOf(STALE_STUDENT);
    const audit = auditOf(STALE_STUDENT);
    const pinned = snapshots.find((snapshot) => snapshot.id === audit?.studentSnapshotId);
    const newer = snapshots.find((snapshot) => snapshot.id !== audit?.studentSnapshotId);

    expect(snapshots).toHaveLength(2);
    expect(pinned?.sourceEffectiveAt).toBe(SEED_RECORD_TIMES.staleRecordEffectiveAt);
    expect(
      Date.parse(newer?.sourceEffectiveAt ?? '') - Date.parse(pinned?.sourceEffectiveAt ?? ''),
    ).toBe(SEVENTEEN_DAYS_MS);
    expect(pinned && audit && isSameProgramAndCatalog(pinned, audit)).toBe(true);
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
