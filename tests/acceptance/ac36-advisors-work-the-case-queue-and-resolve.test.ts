/**
 * @file Acceptance AC36 (planning/13, ADR-0013 §6-7): an assigned and an unassigned advisor open
 * the queue; two advisors claim at once; a non-owner resolves; the assignment is revoked between
 * claim and resolve; the owner resolves. Pending the advisor queue and the events endpoint (#412),
 * so every case is a todo with the exact expected behavior and no assertion is skipped.
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-17
 * @requirement NFR-01
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { describe, it } from 'vitest';

describe('AC36 advisors work the case queue and resolve', () => {
  describe('queue', () => {
    it.todo(
      'GET /v1/advisor/cases lists an open case to the advisor assigned to its student, oldest first (#412)',
    );
    it.todo(
      'GET /v1/advisor/cases does not list the case to an advisor with no active assignment to the student (#412)',
    );
    it.todo(
      'GET /v1/advisor/cases stops listing the case once the assignment has ended at the request time (#412)',
    );
    it.todo(
      'GET /v1/advisor/cases?status=IN_REVIEW lists only cases in review for the assigned advisor (#412)',
    );
    it.todo(
      'GET /v1/advisor/cases?unrouted=true gives an admin the open cases whose student has no active assignment (#412)',
    );
    it.todo('GET /v1/advisor/cases is 404 for a student and for another tenant (#412)');
    it.todo('a queue row carries no user ID, student name or student note (#412)');
  });

  describe('claim and release', () => {
    it.todo(
      'the assigned advisor claims an OPEN case: 201, status IN_REVIEW, owner role ADVISOR with isYou true, lastSequence 2 (#412)',
    );
    it.todo(
      'the CLAIM event is sequence 2 from OPEN to IN_REVIEW and records the actor role (#412)',
    );
    it.todo(
      'two advisors claiming at once with expectedSequence 1 give exactly one 201 and one 409 REVISION_CONFLICT (#412)',
    );
    it.todo(
      'the losing claim changes nothing: the owner is the winner and there is one CLAIM event (#412)',
    );
    it.todo(
      'an advisor with no active assignment who claims gets 404 and nothing is written (#412)',
    );
    it.todo('a claim with a stale expectedSequence is 409 REVISION_CONFLICT (#412)');
    it.todo('the owner releases an IN_REVIEW case: back to OPEN with no owner (#412)');
    it.todo(
      'another advisor who releases a case they do not own gets 404 and nothing is written (#412)',
    );
    it.todo(
      'the student sees the case IN_REVIEW with the owner as role ADVISOR and no user ID (#412)',
    );
  });

  describe('resolve', () => {
    it.todo('a non-owner resolving an IN_REVIEW case gets 404 and the case is unchanged (#412)');
    it.todo('the student resolving a case gets 404 and the case is unchanged (#412)');
    it.todo(
      'the owner resolves with PLAN_REVIEWED and a note: 201, status RESOLVED, owner kept, RESOLVE event carries the resolution and note (#412)',
    );
    it.todo('the owner resolves with STUDENT_ACTION_NEEDED and with REFERRED_OUTSIDE_APP (#412)');
    it.todo(
      'RESOLVE without a resolution is 400 and a resolution on any other action is 400 (#412)',
    );
    it.todo('a resolution note of 1,001 characters is 400 and one of 1,000 is accepted (#412)');
    it.todo(
      'resolving an OPEN case that nobody claimed is refused and the case is unchanged (#412)',
    );
    it.todo(
      'the student reads the resolution and its note, labeled as advice and not permission to enroll (#412)',
    );
    it.todo(
      'resolving changes no plan revision, no course check, no source row and no exception (#412)',
    );
    it.todo('a resolution never creates a waiver or exception (#412)');
    it.todo(
      'RESOLVED is final: CLAIM, RELEASE, RESOLVE and WITHDRAW after it are refused and change nothing (#412)',
    );
    it.todo('after a RESOLVED case the student can open a new case on the same plan (#412)');
  });

  describe('assignment revoked', () => {
    it.todo(
      'after the assignment is revoked between claim and resolve, the former owner resolving gets 404 (AC15) (#412)',
    );
    it.todo('after revocation the former owner reading the case gets 404 (#412)');
    it.todo(
      'after revocation the case is unrouted for an admin and the student still sees it (#412)',
    );
  });

  describe('withdraw', () => {
    it.todo('the student withdraws an OPEN case: status WITHDRAWN, no owner (#412)');
    it.todo(
      'the student withdraws an IN_REVIEW case: status WITHDRAWN and the owner cleared (#412)',
    );
    it.todo('WITHDRAWN is final and the student can then open a new case on the same plan (#412)');
    it.todo('an advisor who withdraws a student case gets 404 and the case is unchanged (#412)');
  });

  describe('events body safety', () => {
    it.todo(
      'an events body naming a tenant, user, role, owner or status is 400 and nothing is written (#412)',
    );
    it.todo('action CREATE on the events endpoint is 400 (#412)');
    it.todo('no email, SMS, webhook or institutional write is made by any case action (#412)');
  });
});
