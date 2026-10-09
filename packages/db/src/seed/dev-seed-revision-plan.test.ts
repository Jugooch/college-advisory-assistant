/**
 * @file Unit tests for the synthetic newer revisions the dev revise command publishes.
 */
import { describe, expect, it } from 'vitest';

import { CourseAttemptIdSchema } from '@caa/domain';

import { SEED_ATTEMPT_IDS, SEED_SLICE_STUDENT_ID } from './dev-seed-academic-plan';
import { seedRecordTimes } from './dev-seed-record-times';
import { buildPersonaRevision, buildStudentRevision } from './dev-seed-revision-plan';
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
  it('drops exactly MATH 102 002 and keeps the other eleven sections', () => {
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

describe('buildPersonaRevision', () => {
  const STUDENT = { id: '30000000-0000-4000-8000-000000000006', number: 6 };
  const BASE = {
    programId: null,
    catalogYear: null,
    attemptIds: [CourseAttemptIdSchema.parse('60000000-0000-4000-8000-000000000106')],
  };

  it('lists the earlier attempts plus one graded attempt, with literal IDs', () => {
    const { attempt, snapshot } = buildPersonaRevision(REVISION_RUN, STUDENT, BASE);

    expect(attempt.id).toBe('60000000-1006-4000-8000-01a1163c1a00');
    expect(snapshot.id).toBe('a0000000-1006-4000-8000-01a1163c1a00');
    expect(snapshot.attemptIds).toEqual([
      '60000000-0000-4000-8000-000000000106',
      '60000000-1006-4000-8000-01a1163c1a00',
    ]);
    expect(snapshot.sourceEffectiveAt).toBe(REVISION_RUN.toISOString());
  });

  it('can be built again from its own result for the same run without a duplicate attempt', () => {
    const first = buildPersonaRevision(REVISION_RUN, STUDENT, BASE);

    const again = buildPersonaRevision(REVISION_RUN, STUDENT, first.snapshot);

    expect(again.snapshot.attemptIds).toEqual(first.snapshot.attemptIds);
    expect(again.snapshot.id).toBe(first.snapshot.id);
  });

  it('uses different IDs for different students and rejects numbers outside 1 to 4095', () => {
    const other = buildPersonaRevision(REVISION_RUN, { ...STUDENT, number: 4 }, BASE);

    expect(other.snapshot.id).toBe('a0000000-1004-4000-8000-01a1163c1a00');
    expect(() => buildPersonaRevision(REVISION_RUN, { ...STUDENT, number: 0 }, BASE)).toThrow(
      RangeError,
    );
    expect(() => buildPersonaRevision(REVISION_RUN, { ...STUDENT, number: 4096 }, BASE)).toThrow(
      RangeError,
    );
    expect(() => buildPersonaRevision(REVISION_RUN, { ...STUDENT, number: 1.5 }, BASE)).toThrow(
      RangeError,
    );
    expect(buildPersonaRevision(REVISION_RUN, { ...STUDENT, number: 4095 }, BASE).snapshot.id).toBe(
      'a0000000-1fff-4000-8000-01a1163c1a00',
    );
  });
});
