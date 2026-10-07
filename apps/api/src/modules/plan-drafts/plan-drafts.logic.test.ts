/**
 * @file Tests for the plan draft save rules: pinned-input comparison, selection checks against
 * the replayed options, audit agreement, and the revision built from the replay.
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-01
 */
import { describe, expect, it } from 'vitest';

import {
  AuditSnapshotIdSchema,
  PlanRevisionCause,
  ScheduleOutcome,
  SectionIdSchema,
  SectionSnapshotIdSchema,
  StudentSnapshotIdSchema,
  UserIdSchema,
} from '@caa/domain';
import {
  buildAuditSnapshot,
  buildScheduleOptionsResponse,
  SYNTHETIC_SCHEDULE_PINNED_INPUTS,
  syntheticId,
} from '@caa/test-kit';

import {
  auditMatchesPins,
  buildNewRevision,
  pinnedInputsMatch,
  resolveSelection,
} from './plan-drafts.logic';

const pins = SYNTHETIC_SCHEDULE_PINNED_INPUTS;
const response = buildScheduleOptionsResponse();
const optionSections = (response.options[0]?.bundles ?? [])
  .flatMap((bundle) => bundle.sections.map((section) => section.sectionId))
  .map((id) => SectionIdSchema.parse(id))
  .sort();

describe('pinnedInputsMatch', () => {
  it('matches identical pinned inputs', () => {
    expect(pinnedInputsMatch(pins, { ...pins })).toBe(true);
  });

  it('matches one moment written with Z and with an offset', () => {
    const offset = { ...pins, studentRecordEffectiveAt: '2026-09-01T01:00:00.000-05:00' };

    expect(pinnedInputsMatch(pins, offset)).toBe(true);
  });

  it.each([
    [
      'studentSnapshotId',
      { studentSnapshotId: StudentSnapshotIdSchema.parse(syntheticId('studentSnapshot', 2)) },
    ],
    ['studentRecordEffectiveAt', { studentRecordEffectiveAt: '2026-09-01T06:00:00.001Z' }],
    ['auditRecordEffectiveAt', { auditRecordEffectiveAt: '2026-09-01T06:00:00.001Z' }],
    ['auditSource', { auditSource: 'other-audit' }],
    ['auditVersion', { auditVersion: 'audit_demo_r2' }],
    ['rulesetVersion', { rulesetVersion: 'demo-2026.2' }],
    [
      'sectionSnapshotId',
      { sectionSnapshotId: SectionSnapshotIdSchema.parse(syntheticId('sectionSnapshot', 2)) },
    ],
    ['campusTransitionVersion', { campusTransitionVersion: null }],
    ['solverWorkCap', { solverWorkCap: 1 }],
    ['constraintHash', { constraintHash: `sha256:${'0b'.repeat(32)}` }],
  ])('refuses a different %s', (_key, change) => {
    expect(pinnedInputsMatch(pins, { ...pins, ...change })).toBe(false);
  });
});

describe('resolveSelection', () => {
  it('accepts the sections of a replayed option and returns them sorted', () => {
    const reversed = [...optionSections].reverse();

    expect(resolveSelection(response, reversed)).toEqual(optionSections);
  });

  it('refuses a set that is not one of the options, a subset, or a superset', () => {
    const other = SectionIdSchema.parse(syntheticId('section', 99));

    expect(resolveSelection(response, [other])).toBe('INVALID');
    expect(resolveSelection(response, optionSections.slice(1))).toBe('INVALID');
    expect(resolveSelection(response, [...optionSections, other])).toBe('INVALID');
  });

  it('refuses no selection when the outcome has options', () => {
    expect(resolveSelection(response, null)).toBe('INVALID');
  });

  it('accepts null and refuses a selection when the outcome has no options', () => {
    const timedOut = buildScheduleOptionsResponse({
      outcome: ScheduleOutcome.SearchTimeout,
      searchComplete: false,
      options: [],
      courseIds: response.courseIds,
    });

    expect(resolveSelection(timedOut, null)).toBeNull();
    expect(resolveSelection(timedOut, optionSections)).toBe('INVALID');
  });
});

describe('auditMatchesPins', () => {
  const audit = buildAuditSnapshot({
    auditSource: pins.auditSource,
    auditVersion: pins.auditVersion,
    studentRecordEffectiveAt: pins.auditRecordEffectiveAt,
  });

  it('matches the audit the replay pinned', () => {
    expect(auditMatchesPins(audit, pins)).toBe(true);
  });

  it.each([
    ['source', { auditSource: 'other-audit' }],
    ['version', { auditVersion: 'audit_demo_r2' }],
    ['record time', { studentRecordEffectiveAt: '2026-09-01T07:00:00.000Z' }],
  ])('refuses an audit with another %s', (_field, change) => {
    expect(auditMatchesPins({ ...audit, ...change }, pins)).toBe(false);
  });
});

describe('buildNewRevision', () => {
  it('stores the replay and its pinned inputs, never anything from the client', () => {
    const revision = buildNewRevision({
      request: {
        termId: response.term.id,
        courseIds: response.courseIds,
        creditSelections: [],
        constraints: [],
      },
      result: response,
      selectedSectionIds: optionSections,
      auditSnapshotId: AuditSnapshotIdSchema.parse(syntheticId('audit', 1)),
      cause: PlanRevisionCause.Saved,
      createdBy: UserIdSchema.parse(syntheticId('user', 1)),
      createdAt: '2026-09-01T12:00:00.000Z',
    });

    expect(revision).toMatchObject({
      cause: PlanRevisionCause.Saved,
      outcome: response.outcome,
      courseIds: response.courseIds,
      selectedSectionIds: optionSections,
      result: response,
      ...pins,
    });
  });
});
