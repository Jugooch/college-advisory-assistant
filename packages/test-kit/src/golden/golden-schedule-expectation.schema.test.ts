/**
 * @file Tests for the scheduling expectation schemas, one rule at a time: each test accepts a
 *   valid value, then breaks one rule and asserts that rule's message. The issue-explains rule
 *   is tested against the domain's `scheduleIssuesExplainCheck` semantics, including the
 *   undecided credit-load exception.
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { describe, expect, it } from 'vitest';

import { CheckKind, CheckState, ReasonCode, ScheduleOutcome } from '@caa/domain';

import { SYNTHETIC_COURSES } from '../fixtures/synthetic-courses';
import { syntheticId } from '../fixtures/synthetic-id';
import {
  ExpectedScheduleCheckSchema,
  ExpectedScheduleIssueSchema,
  ExpectedScheduleOptionSchema,
  ExpectedScheduleSchema,
} from './golden-schedule-expectation.schema';

const SECTION_A = syntheticId('section', 1);
const SECTION_B = syntheticId('section', 2);
const SCHEDULE = CheckKind.ScheduleFeasibility;
const PASS = { check: { kind: SCHEDULE, state: CheckState.Pass, reasonCode: null }, issues: [] };
const EXPLAINS = /A non-PASS schedule check has issues that mean its state and include its reason/;

/**
 * Builds a FAIL meeting-conflict check naming one section.
 *
 * @param sectionId - The section.
 * @returns The check and its issue.
 */
function conflictOn(sectionId: string): unknown {
  return {
    check: { kind: SCHEDULE, state: CheckState.Fail, reasonCode: ReasonCode.MeetingConflict },
    issues: [{ reasonCode: ReasonCode.MeetingConflict, sectionIds: [sectionId] }],
  };
}

/**
 * Builds a complete NO_FEASIBLE_PLAN expectation.
 *
 * @param conflictSet - Its conflict set.
 * @returns The expectation, unvalidated.
 */
function noPlan(conflictSet: unknown): unknown {
  return {
    outcome: ScheduleOutcome.NoFeasiblePlan,
    searchComplete: true,
    options: [],
    conflictSet,
    unresolved: [],
  };
}

describe('ExpectedScheduleIssueSchema', () => {
  it('names as many sections as the reason does', () => {
    const missing = { reasonCode: ReasonCode.SectionDataMissing, sectionIds: [] };

    expect(
      ExpectedScheduleIssueSchema.parse({ ...missing, courseId: SYNTHETIC_COURSES.math102.id }),
    ).toMatchObject(missing);
    expect(() =>
      ExpectedScheduleIssueSchema.parse({ reasonCode: ReasonCode.MeetingConflict, sectionIds: [] }),
    ).toThrow(/sectionIds must name as many sections as the reason does/);
  });

  it('lists shared weekdays ascending', () => {
    const issue = (weekdays: readonly string[]): unknown => ({
      reasonCode: ReasonCode.MeetingConflict,
      sectionIds: [SECTION_A, SECTION_B],
      sharedDates: { firstDate: '2027-01-11', lastDate: '2027-05-07', weekdays },
    });

    expect(ExpectedScheduleIssueSchema.parse(issue(['FRIDAY', 'MONDAY']))).toBeDefined();
    expect(() => ExpectedScheduleIssueSchema.parse(issue(['MONDAY', 'FRIDAY']))).toThrow(
      /sharedDates.weekdays must be distinct and ascending/,
    );
  });
});

describe('ExpectedScheduleCheckSchema mirrors the domain issue rule', () => {
  const unknownLoad = (issues: readonly unknown[]): unknown => ({
    check: {
      kind: SCHEDULE,
      state: CheckState.Unknown,
      reasonCode: ReasonCode.VariableCreditUnselected,
    },
    issues,
  });
  const tba = { reasonCode: ReasonCode.MeetingTimeUnknown, sectionIds: [SECTION_A] };

  it('accepts an UNKNOWN credit-load reason with no issue, or with other UNKNOWN issues', () => {
    expect(ExpectedScheduleCheckSchema.parse(unknownLoad([]))).toBeDefined();
    expect(ExpectedScheduleCheckSchema.parse(unknownLoad([tba]))).toBeDefined();
    expect(
      ExpectedScheduleCheckSchema.parse({
        check: {
          kind: SCHEDULE,
          state: CheckState.Unknown,
          reasonCode: ReasonCode.CreditBoundsUndefined,
        },
        issues: [],
      }),
    ).toBeDefined();
  });

  it('rejects an UNKNOWN credit-load reason beside an issue that means FAIL', () => {
    const fail = { reasonCode: ReasonCode.MeetingConflict, sectionIds: [SECTION_A] };

    expect(() => ExpectedScheduleCheckSchema.parse(unknownLoad([fail]))).toThrow(EXPLAINS);
  });

  it('rejects a FAIL with a credit-load reason and no issue', () => {
    const check = {
      kind: SCHEDULE,
      state: CheckState.Fail,
      reasonCode: ReasonCode.VariableCreditUnselected,
    };

    expect(() => ExpectedScheduleCheckSchema.parse({ check, issues: [] })).toThrow(EXPLAINS);
  });

  it('rejects any CONDITIONAL schedule check', () => {
    const check = {
      kind: SCHEDULE,
      state: CheckState.Conditional,
      reasonCode: ReasonCode.MeetingTimeUnknown,
    };

    expect(() => ExpectedScheduleCheckSchema.parse({ check, issues: [] })).toThrow(EXPLAINS);
    expect(() => ExpectedScheduleCheckSchema.parse({ check, issues: [tba] })).toThrow(EXPLAINS);
  });
});

describe('ExpectedScheduleOptionSchema', () => {
  it('takes a CREDIT_LOAD check as its credit load, and nothing else', () => {
    const option = (kind: CheckKind): unknown => ({
      sectionIds: [SECTION_A],
      scheduleFeasibility: PASS,
      creditLoad: { kind, state: CheckState.Pass, reasonCode: null },
    });

    expect(ExpectedScheduleOptionSchema.parse(option(CheckKind.CreditLoad))).toBeDefined();
    expect(() => ExpectedScheduleOptionSchema.parse(option(CheckKind.Prerequisite))).toThrow(
      /creditLoad must be a CREDIT_LOAD check/,
    );
  });
});

describe('ExpectedScheduleSchema', () => {
  it('lists only FAIL schedule or credit-load checks as conflicts', () => {
    const loadFail = {
      check: {
        kind: CheckKind.CreditLoad,
        state: CheckState.Fail,
        reasonCode: ReasonCode.CreditLimitExceeded,
      },
      issues: [],
    };
    const unknown = {
      check: {
        kind: SCHEDULE,
        state: CheckState.Unknown,
        reasonCode: ReasonCode.MeetingTimeUnknown,
      },
      issues: [{ reasonCode: ReasonCode.MeetingTimeUnknown, sectionIds: [SECTION_A] }],
    };

    expect(
      ExpectedScheduleSchema.parse(noPlan({ items: [loadFail], omittedCount: 0 })),
    ).toBeDefined();
    expect(() =>
      ExpectedScheduleSchema.parse(noPlan({ items: [unknown], omittedCount: 0 })),
    ).toThrow(/A conflict is a FAIL SCHEDULE_FEASIBILITY or CREDIT_LOAD check/);
  });

  it('lists only missing sections or links as unresolved', () => {
    const needs = (reasonCode: ReasonCode, extra: object): unknown => ({
      outcome: ScheduleOutcome.NeedsVerification,
      searchComplete: false,
      options: [],
      conflictSet: null,
      unresolved: [
        {
          check: { kind: SCHEDULE, state: CheckState.Unknown, reasonCode },
          issues: [{ reasonCode, sectionIds: [SECTION_A], ...extra }],
        },
      ],
    });
    const lab = { courseId: SYNTHETIC_COURSES.phys201Lab.id };

    expect(
      ExpectedScheduleSchema.parse(needs(ReasonCode.LinkedSectionUnavailable, lab)),
    ).toBeDefined();
    expect(() => ExpectedScheduleSchema.parse(needs(ReasonCode.MeetingTimeUnknown, {}))).toThrow(
      /An unresolved item is an UNKNOWN check for a missing section or link/,
    );
  });

  it('omits conflicts only once 20 are listed', () => {
    const full = Array.from({ length: 20 }, (_, index) =>
      conflictOn(syntheticId('section', index + 1)),
    );

    expect(ExpectedScheduleSchema.parse(noPlan({ items: full, omittedCount: 3 }))).toBeDefined();
    expect(() =>
      ExpectedScheduleSchema.parse(noPlan({ items: [conflictOn(SECTION_A)], omittedCount: 1 })),
    ).toThrow(/omittedCount must be 0 unless items is full/);
  });
});
