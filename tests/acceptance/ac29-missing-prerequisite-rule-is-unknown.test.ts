/**
 * @file Acceptance AC29 (second file): a course with no rule row is UNKNOWN
 * `PREREQUISITE_RULE_MISSING` and never a PASS, while an explicit `NONE` rule is PASS with no
 * decisive leaves (ADR-0012 §1). Expected values restate golden cases GC-NOPRE-001, GC-NOPRE-004 literally.
 * @requirement FR-05
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/adr/0012-explicit-no-prerequisite-and-repeat-credit.md
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { AggregateState, CheckKind, CheckState, ReasonCode } from '@caa/domain';
import { buildPrerequisiteRule, completedAttempt, none, SYNTHETIC_COURSES } from '@caa/test-kit';

import {
  buildAcademicApp,
  checkCourses,
  createAcademicWorld,
  resetAcademicWorld,
} from '../support/academic-endpoints-harness';
import { acceptanceIt } from '../support/known-findings';

const { math102, phys201 } = SYNTHETIC_COURSES;

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const app = buildAcademicApp(world);

describe('AC29 a missing rule is UNKNOWN and an explicit NONE rule is PASS', () => {
  beforeEach(() => {
    resetAcademicWorld(world);
  });

  acceptanceIt(
    'AC29',
    'reports UNKNOWN PREREQUISITE_RULE_MISSING, not a PASS, for a course with no rule row',
    async () => {
      resetAcademicWorld(world, { requirements: [{ candidateCourseIds: [phys201.id] }] });
      world.rules = [buildPrerequisiteRule()];

      const response = await checkCourses(app, { courseIds: [phys201.id] });

      expect(response).toMatchObject({
        statusCode: 200,
        body: {
          data: {
            courseResults: [
              {
                courseId: phys201.id,
                prerequisite: {
                  kind: CheckKind.Prerequisite,
                  state: CheckState.Unknown,
                  reasonCode: ReasonCode.PrerequisiteRuleMissing,
                  evidence: { rulesetVersion: 'demo-2026.1', decisiveLeaves: [] },
                },
              },
            ],
            aggregate: AggregateState.NeedsVerification,
          },
        },
      });
      expect(response.body).not.toMatchObject({
        data: { courseResults: [{ prerequisite: { state: CheckState.Pass } }] },
      });
    },
  );

  acceptanceIt(
    'AC29',
    'treats a rule that exists only in another ruleset version as a missing rule',
    async () => {
      resetAcademicWorld(world, { requirements: [{ candidateCourseIds: [phys201.id] }] });
      world.rules = [
        buildPrerequisiteRule(),
        buildPrerequisiteRule({ courseId: phys201.id, rulesetVersion: 'demo-2025.1' }, 2),
      ];

      const response = await checkCourses(app, { courseIds: [phys201.id] });

      expect(response).toMatchObject({
        statusCode: 200,
        body: {
          data: {
            courseResults: [
              {
                courseId: phys201.id,
                prerequisite: {
                  state: CheckState.Unknown,
                  reasonCode: ReasonCode.PrerequisiteRuleMissing,
                },
              },
            ],
            aggregate: AggregateState.NeedsVerification,
          },
        },
      });
    },
  );

  acceptanceIt(
    'AC29',
    'keeps a course with a rule PASS while a sibling with no rule row is UNKNOWN',
    async () => {
      resetAcademicWorld(world, {
        attempts: [completedAttempt()],
        requirements: [{ candidateCourseIds: [math102.id, phys201.id], remainingCourseCount: 2 }],
      });

      const response = await checkCourses(app, { courseIds: [math102.id, phys201.id] });

      expect(response).toMatchObject({
        statusCode: 200,
        body: {
          data: {
            courseResults: [
              { courseId: math102.id, prerequisite: { state: CheckState.Pass } },
              {
                courseId: phys201.id,
                prerequisite: {
                  state: CheckState.Unknown,
                  reasonCode: ReasonCode.PrerequisiteRuleMissing,
                },
              },
            ],
            aggregate: AggregateState.NeedsVerification,
          },
        },
      });
    },
  );

  it('passes a course whose rule is an explicit NONE, with no decisive leaves', async () => {
    resetAcademicWorld(world, { requirements: [{ candidateCourseIds: [phys201.id] }] });
    world.rules = [
      buildPrerequisiteRule(),
      buildPrerequisiteRule({ courseId: phys201.id, expression: none() }, 2),
    ];

    const response = await checkCourses(app, { courseIds: [phys201.id] });

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          courseResults: [
            {
              courseId: phys201.id,
              prerequisite: {
                kind: CheckKind.Prerequisite,
                state: CheckState.Pass,
                sourceRef: 'demo-rule-0002',
                evidence: { rulesetVersion: 'demo-2026.1', decisiveLeaves: [] },
              },
            },
          ],
          aggregate: AggregateState.Validated,
        },
      },
    });
  });
});
