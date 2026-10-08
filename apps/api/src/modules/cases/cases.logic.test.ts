/**
 * @file Tests the case transition table over every status, action, and actor combination:
 * each allowed move gives its target status, and every other combination is refused.
 * @requirement FR-12
 * @requirement FR-14
 */
import { describe, expect, it } from 'vitest';

import { CaseAction, CaseStatus, Role, type UserId } from '@caa/domain';

import {
  allowedCaseActions,
  CaseActor,
  caseActorOf,
  eventActorRoleOf,
  isLiveCaseStatus,
  mayAttemptCaseAction,
  nextCaseStatus,
} from './cases.logic';

const STATUSES = Object.values(CaseStatus);
const ACTIONS = Object.values(CaseAction);
const ACTORS = Object.values(CaseActor);

/** The allowed moves, written out independently of the implementation's table. */
const ALLOWED = new Map<string, CaseStatus>([
  [`${CaseStatus.Open}|${CaseAction.Withdraw}|${CaseActor.Student}`, CaseStatus.Withdrawn],
  [`${CaseStatus.Open}|${CaseAction.Claim}|${CaseActor.Reviewer}`, CaseStatus.InReview],
  [`${CaseStatus.InReview}|${CaseAction.Withdraw}|${CaseActor.Student}`, CaseStatus.Withdrawn],
  [`${CaseStatus.InReview}|${CaseAction.Release}|${CaseActor.Owner}`, CaseStatus.Open],
  [`${CaseStatus.InReview}|${CaseAction.Resolve}|${CaseActor.Owner}`, CaseStatus.Resolved],
]);

const COMBINATIONS = STATUSES.flatMap((status) =>
  ACTIONS.flatMap((action) => ACTORS.map((actor) => ({ status, action, actor }))),
);

describe('nextCaseStatus', () => {
  it('covers every status, action, and actor combination', () => {
    expect(COMBINATIONS).toHaveLength(4 * 5 * 3);
  });

  it.each(COMBINATIONS)(
    '$status + $action by $actor gives the table result',
    ({ status, action, actor }) => {
      expect(nextCaseStatus(status, action, actor)).toBe(
        ALLOWED.get(`${status}|${action}|${actor}`) ?? null,
      );
    },
  );

  it('never accepts CREATE', () => {
    const results = STATUSES.flatMap((status) =>
      ACTORS.map((actor) => nextCaseStatus(status, CaseAction.Create, actor)),
    );
    expect(results.every((result) => result === null)).toBe(true);
  });

  it('treats RESOLVED and WITHDRAWN as final for every action and actor', () => {
    const results = [CaseStatus.Resolved, CaseStatus.Withdrawn].flatMap((status) =>
      ACTIONS.flatMap((action) => ACTORS.map((actor) => nextCaseStatus(status, action, actor))),
    );
    expect(results.every((result) => result === null)).toBe(true);
  });
});

describe('allowedCaseActions', () => {
  it.each(STATUSES.flatMap((status) => ACTORS.map((actor) => ({ status, actor }))))(
    'for $status as $actor agrees with nextCaseStatus',
    ({ status, actor }) => {
      const expected = ACTIONS.filter((action) => nextCaseStatus(status, action, actor) !== null);

      expect([...allowedCaseActions(status, actor)].sort()).toEqual([...expected].sort());
    },
  );

  it('lists each action once', () => {
    for (const { status, actor } of STATUSES.flatMap((s) =>
      ACTORS.map((a) => ({ status: s, actor: a })),
    )) {
      const actions = allowedCaseActions(status, actor);
      expect(new Set(actions).size).toBe(actions.length);
    }
  });

  it('gives a student only WITHDRAW, and only while the case is not final', () => {
    expect(allowedCaseActions(CaseStatus.Open, CaseActor.Student)).toEqual([CaseAction.Withdraw]);
    expect(allowedCaseActions(CaseStatus.InReview, CaseActor.Student)).toEqual([
      CaseAction.Withdraw,
    ]);
    expect(allowedCaseActions(CaseStatus.Resolved, CaseActor.Student)).toEqual([]);
  });

  it('gives a reviewer CLAIM on an open case and nothing on an owned one', () => {
    expect(allowedCaseActions(CaseStatus.Open, CaseActor.Reviewer)).toEqual([CaseAction.Claim]);
    expect(allowedCaseActions(CaseStatus.InReview, CaseActor.Reviewer)).toEqual([]);
  });

  it('gives the owner RELEASE and RESOLVE while in review', () => {
    expect(allowedCaseActions(CaseStatus.InReview, CaseActor.Owner)).toEqual([
      CaseAction.Release,
      CaseAction.Resolve,
    ]);
  });
});

describe('isLiveCaseStatus', () => {
  it.each(STATUSES)('is true only for OPEN and IN_REVIEW: %s', (status) => {
    expect(isLiveCaseStatus(status)).toBe(
      status === CaseStatus.Open || status === CaseStatus.InReview,
    );
  });
});

const STUDENT_USER = 'user-student' as UserId;
const STAFF_USER = 'user-staff' as UserId;
const OTHER_STAFF = 'user-other' as UserId;

describe('caseActorOf', () => {
  it.each([
    { name: 'the student', user: STUDENT_USER, owner: null, expected: CaseActor.Student },
    { name: 'the owner', user: STAFF_USER, owner: STAFF_USER, expected: CaseActor.Owner },
    { name: 'other staff', user: OTHER_STAFF, owner: STAFF_USER, expected: CaseActor.Reviewer },
    { name: 'staff, no owner', user: STAFF_USER, owner: null, expected: CaseActor.Reviewer },
  ])('names $name', ({ user, owner, expected }) => {
    const actor = { userId: user, studentUserId: STUDENT_USER };

    expect(caseActorOf(actor, { ownerUserId: owner })).toBe(expected);
  });
});

describe('mayAttemptCaseAction', () => {
  it.each([
    { action: CaseAction.Claim, actor: CaseActor.Student, expected: false },
    { action: CaseAction.Claim, actor: CaseActor.Reviewer, expected: true },
    { action: CaseAction.Claim, actor: CaseActor.Owner, expected: true },
    { action: CaseAction.Release, actor: CaseActor.Reviewer, expected: false },
    { action: CaseAction.Release, actor: CaseActor.Owner, expected: true },
    { action: CaseAction.Resolve, actor: CaseActor.Reviewer, expected: false },
    { action: CaseAction.Resolve, actor: CaseActor.Student, expected: false },
    { action: CaseAction.Resolve, actor: CaseActor.Owner, expected: true },
    { action: CaseAction.Withdraw, actor: CaseActor.Student, expected: true },
    { action: CaseAction.Withdraw, actor: CaseActor.Reviewer, expected: false },
    { action: CaseAction.Create, actor: CaseActor.Student, expected: false },
  ])('$action by $actor is $expected', ({ action, actor, expected }) => {
    expect(mayAttemptCaseAction(action, actor)).toBe(expected);
  });
});

describe('eventActorRoleOf', () => {
  it.each([CaseAction.Create, CaseAction.Withdraw])('writes STUDENT for %s', (action) => {
    expect(eventActorRoleOf(action, { isAdvisor: true, hasActiveAssignment: true })).toBe(
      Role.Student,
    );
  });

  it.each([CaseAction.Claim, CaseAction.Release, CaseAction.Resolve])(
    'writes ADVISOR for %s only with the advisor role and an active assignment',
    (action) => {
      expect(eventActorRoleOf(action, { isAdvisor: true, hasActiveAssignment: true })).toBe(
        Role.Advisor,
      );
      expect(eventActorRoleOf(action, { isAdvisor: true, hasActiveAssignment: false })).toBe(
        Role.Admin,
      );
      expect(eventActorRoleOf(action, { isAdvisor: false, hasActiveAssignment: false })).toBe(
        Role.Admin,
      );
    },
  );
});
