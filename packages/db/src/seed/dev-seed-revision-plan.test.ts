/**
 * @file Unit tests for the synthetic newer revisions the dev revise command publishes.
 */
import { describe, expect, it } from 'vitest';

import { SEED_ATTEMPT_IDS, SEED_SLICE_STUDENT_ID } from './dev-seed-academic-plan';
import { seedRecordTimes } from './dev-seed-record-times';
import { buildStudentRevision } from './dev-seed-revision-plan';
import { buildDevSeedSectionPlan, buildWithdrawnSectionSnapshot } from './dev-seed-section-plan';

const SEED_RUN = new Date('2026-10-01T12:00:00.000Z');
const REVISION_RUN = new Date('2026-10-07T12:00:00.000Z');

describe('buildStudentRevision', () => {
  it('replaces the in-progress attempt with a graded one in a snapshot effective at the run', () => {
    const { attempt, snapshot } = buildStudentRevision(REVISION_RUN, SEED_SLICE_STUDENT_ID);

    expect(snapshot.sourceEffectiveAt).toBe(REVISION_RUN.toISOString());
    expect(snapshot.attemptIds).toEqual([
      SEED_ATTEMPT_IDS.math101First,
      SEED_ATTEMPT_IDS.math101Repeat,
      attempt.id,
    ]);
    expect(snapshot.attemptIds).not.toContain(SEED_ATTEMPT_IDS.phys201InProgress);
    expect(attempt.grade).toEqual({ scheme: 'LETTER', value: 'C' });
  });

  it('is newer than the seed run and deterministic for a given run time', () => {
    const first = buildStudentRevision(REVISION_RUN, SEED_SLICE_STUDENT_ID);

    expect(Date.parse(first.snapshot.sourceEffectiveAt)).toBeGreaterThan(
      Date.parse(seedRecordTimes(SEED_RUN).currentRecordEffectiveAt),
    );
    expect(buildStudentRevision(REVISION_RUN, SEED_SLICE_STUDENT_ID)).toEqual(first);
    expect(
      buildStudentRevision(new Date(REVISION_RUN.getTime() + 1), SEED_SLICE_STUDENT_ID).snapshot.id,
    ).not.toBe(first.snapshot.id);
  });
});

describe('buildWithdrawnSectionSnapshot', () => {
  it('drops exactly MATH 102 002 and keeps the other nine sections', () => {
    const seeded = buildDevSeedSectionPlan(SEED_RUN).snapshot;

    const revised = buildWithdrawnSectionSnapshot(REVISION_RUN);

    const key = (section: { courseId: string; sectionCode: string }): string =>
      `${section.courseId}|${section.sectionCode}`;
    const missing = seeded.sections.map(key).filter((k) => !revised.sections.map(key).includes(k));
    expect(revised.sections).toHaveLength(seeded.sections.length - 1);
    expect(missing).toHaveLength(1);
    expect(seeded.sections.find((s) => key(s) === missing[0])).toMatchObject({
      sourceSectionId: 'SYN-SEC-02',
      sectionCode: '002',
    });
  });

  it('is a distinct snapshot effective at the run, with IDs that never match the seed run', () => {
    const seeded = buildDevSeedSectionPlan(REVISION_RUN).snapshot;

    const revised = buildWithdrawnSectionSnapshot(REVISION_RUN);

    expect(revised.sourceEffectiveAt).toBe(REVISION_RUN.toISOString());
    expect(revised.id).not.toBe(seeded.id);
    const seededIds = new Set(seeded.sections.map((section) => section.id));
    expect(revised.sections.some((section) => seededIds.has(section.id))).toBe(false);
    expect(buildWithdrawnSectionSnapshot(REVISION_RUN)).toEqual(revised);
  });
});
