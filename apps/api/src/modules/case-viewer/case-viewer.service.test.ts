/**
 * @file Service tests for the case viewer with injected fakes: the null context for a source
 * discrepancy, a missing student, and the allowed actions for each kind of actor.
 * @requirement FR-12
 * @requirement FR-14
 */
import { describe, expect, it } from 'vitest';

import { CaseAction, CaseReason, DiscrepancySubject, Role } from '@caa/domain';
import {
  buildActor,
  buildAdvisingCase,
  buildCaseEvent,
  buildInReviewAdvisingCase,
  buildPlanRevisionView,
  buildStudent,
} from '@caa/test-kit';

import { createRecordingLogger } from '../../testing/in-memory-repositories';
import { createCaseViewerService } from './case-viewer.service';

const studentActor = buildActor({ roles: [Role.Student] }, 1);
const owner = buildActor({ roles: [Role.Advisor] }, 2);
const reviewer = buildActor({ roles: [Role.Advisor] }, 5);
const student = buildStudent({ userId: studentActor.userId }, 1);
const events = [buildCaseEvent({})];

/**
 * Builds the viewer over fakes.
 *
 * @param hasStudent - Whether the student record is found.
 * @returns The viewer and the logger.
 */
function setup(hasStudent = true) {
  const viewer = createCaseViewerService({
    students: { findById: () => Promise.resolve(hasStudent ? student : null) },
    caseContext: {
      hasRevision: () => Promise.resolve(true),
      contextOf: () => Promise.resolve(buildPlanRevisionView()),
    },
  });
  return { viewer, logger: createRecordingLogger() };
}

describe('CaseViewerService.viewCase', () => {
  it.each([
    { name: 'the student', actor: studentActor, expected: [CaseAction.Withdraw] },
    { name: 'the owner', actor: owner, expected: [CaseAction.Release, CaseAction.Resolve] },
    { name: 'another advisor', actor: reviewer, expected: [] },
  ])('gives $name the actions the case logic allows', async ({ actor, expected }) => {
    const { viewer, logger } = setup();

    const view = await viewer.viewCase(
      actor,
      { advisingCase: buildInReviewAdvisingCase(), events },
      { logger },
    );

    expect(view.allowedActions).toEqual(expected);
  });

  it('loads the frozen context, and gives a null context for a source discrepancy', async () => {
    const { viewer, logger } = setup();

    const plan = await viewer.viewCase(
      owner,
      { advisingCase: buildAdvisingCase(), events },
      { logger },
    );
    const discrepancy = await viewer.viewCase(
      owner,
      {
        advisingCase: buildAdvisingCase({
          reason: CaseReason.SourceDiscrepancy,
          planRevisionId: null,
          discrepancySubject: DiscrepancySubject.CourseAttempt,
        }),
        events,
      },
      { logger },
    );

    expect(plan.context).not.toBeNull();
    expect(discrepancy.context).toBeNull();
  });

  it('treats a missing student as having no student user, so nobody is shown as the student', async () => {
    const { viewer, logger } = setup(false);

    const view = await viewer.viewCase(
      studentActor,
      { advisingCase: buildAdvisingCase(), events },
      { logger },
    );

    expect(view.allowedActions).toEqual([CaseAction.Claim]);
  });
});
