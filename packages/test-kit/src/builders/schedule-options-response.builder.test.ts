/**
 * @file Tests for the schedule-options response builder: the default complete response, an AC12
 *   timeout, and a loud failure for an outcome whose evidence doesn't fit it.
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { describe, expect, it } from 'vitest';

import { ScheduleOutcome } from '@caa/domain';

import { SYNTHETIC_CAMPUSES } from '../fixtures/synthetic-campuses';
import { SYNTHETIC_COURSES } from '../fixtures/synthetic-courses';
import { buildScheduleOption, buildSectionBundle } from './schedule-option.builder';
import {
  buildScheduleOptionsResponse,
  SYNTHETIC_SCHEDULE_PINNED_INPUTS,
} from './schedule-options-response.builder';
import { buildOnlineAsynchronousSection, buildSection } from './section.builder';

describe('buildScheduleOptionsResponse', () => {
  it('builds a complete OPTIONS_FOUND with one option and every limitation code', () => {
    expect(buildScheduleOptionsResponse()).toMatchObject({
      outcome: 'OPTIONS_FOUND',
      searchComplete: true,
      courseIds: ['50000000-0000-4000-8000-000000000102'],
      options: [{ rank: 1 }],
      conflictSet: null,
      unresolved: [],
      limitations: [
        'SEAT_AVAILABILITY_NOT_CHECKED',
        'REGISTRATION_READINESS_NOT_CHECKED',
        'NOT_REGISTERED',
      ],
      courses: [],
    });
  });

  it('pins the synthetic inputs', () => {
    expect(SYNTHETIC_SCHEDULE_PINNED_INPUTS).toEqual({
      studentSnapshotId: 'a0000000-0000-4000-8000-000000000001',
      studentRecordEffectiveAt: '2026-09-01T06:00:00.000Z',
      auditRecordEffectiveAt: '2026-09-01T06:00:00.000Z',
      auditSource: 'demo-audit',
      auditVersion: 'audit_demo_r1',
      rulesetVersion: 'demo-2026.1',
      sectionSnapshotId: 'c2000000-0000-4000-8000-000000000001',
      campusTransitionVersion: 'demo-2026.1',
      solverWorkCap: 3_000_000,
      constraintHash: `sha256:${'0a'.repeat(32)}`,
    });
  });

  it('builds a SEARCH_TIMEOUT with no options when the course is named', () => {
    const timeout = buildScheduleOptionsResponse({
      outcome: ScheduleOutcome.SearchTimeout,
      searchComplete: false,
      options: [],
      courseIds: ['50000000-0000-4000-8000-000000000102'],
    });

    expect(timeout).toMatchObject({
      outcome: 'SEARCH_TIMEOUT',
      searchComplete: false,
      options: [],
    });
  });

  it('fails where it is built when the outcome and its evidence disagree', () => {
    expect(() => buildScheduleOptionsResponse({ outcome: ScheduleOutcome.NoFeasiblePlan })).toThrow(
      /searchComplete, options, conflictSet, and unresolved must match the outcome/,
    );
  });

  it('defaults term to the synthetic schedule term of the section builders', () => {
    expect(buildScheduleOptionsResponse().term).toEqual({
      id: 'b0000000-0000-4000-8000-000000000004',
      termCode: '2027SP',
      startsOn: '2027-01-11',
      endsOn: '2027-05-07',
    });
  });

  it('defaults campuses to exactly the campus the default option names', () => {
    expect(buildScheduleOptionsResponse().campuses).toEqual([
      { id: 'd0000000-0000-4000-8000-000000000001', name: 'Demo North Campus' },
    ]);
  });

  it('lists the campuses of overridden options, once each, sorted by id', () => {
    const south = buildSection(
      { campusId: SYNTHETIC_CAMPUSES.south.id, courseId: SYNTHETIC_COURSES.math102.id },
      2,
    );
    const response = buildScheduleOptionsResponse({
      options: [
        buildScheduleOption({ bundles: [buildSectionBundle([south], 300)] }),
        buildScheduleOption({ rank: 2 }),
      ],
    });

    expect(response.campuses).toEqual([
      { id: 'd0000000-0000-4000-8000-000000000001', name: 'Demo North Campus' },
      { id: 'd0000000-0000-4000-8000-000000000002', name: 'Demo South Campus' },
    ]);
  });

  it('defaults campuses to an empty list when the response names no campus', () => {
    const online = buildScheduleOption({
      bundles: [buildSectionBundle([buildOnlineAsynchronousSection()], 300)],
    });

    expect(buildScheduleOptionsResponse({ options: [online] }).campuses).toEqual([]);
    expect(
      buildScheduleOptionsResponse({
        outcome: ScheduleOutcome.SearchTimeout,
        searchComplete: false,
        options: [],
        courseIds: ['50000000-0000-4000-8000-000000000102'],
      }).campuses,
    ).toEqual([]);
  });

  it('keeps an overridden campuses list instead of deriving one', () => {
    const campuses = [{ id: SYNTHETIC_CAMPUSES.north.id, name: 'Renamed North' }];

    expect(buildScheduleOptionsResponse({ campuses }).campuses).toEqual(campuses);
  });
});
