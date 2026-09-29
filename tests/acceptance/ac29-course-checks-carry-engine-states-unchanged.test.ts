/**
 * @file Acceptance: course checks reach the student with the states the golden corpus adjudicated,
 * unchanged by the API. AC02 stays CONDITIONAL only where policy permits, AC05 competing courses
 * are never both satisfied, and AC18 counts the selected credit value. A course with no rule has
 * `prerequisite: null`, never a PASS, and a course outside the tenant's catalog is refused.
 * Expected values restate golden cases GC-IP-001, GC-IP-002, GC-ALLOC-001, GC-ALLOC-004,
 * GC-APP-001, GC-VAR-001 and GC-VAR-002 literally.
 * @requirement FR-05
 * @requirement FR-06
 * @requirement FR-09
 * @requirement FR-10
 * @requirement AC02
 * @requirement AC05
 * @requirement AC18
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { AggregateState, CheckKind, CheckState, ReasonCode } from '@caa/domain';
import {
  buildCourse,
  buildPrerequisiteRule,
  completedAttempt,
  inProgressAttempt,
  SYNTHETIC_COURSES,
  SYNTHETIC_TENANTS,
} from '@caa/test-kit';

import {
  buildAcademicApp,
  checkCourses,
  createAcademicWorld,
  resetAcademicWorld,
} from '../support/academic-endpoints-harness';
import { summarizeError } from '../support/api-harness';

const { math101, math102, phys201, ind390 } = SYNTHETIC_COURSES;
const REQ_001 = 'demo-audit:audit_demo_r1:demo-audit/REQ-001';
const REQ_002 = 'demo-audit:audit_demo_r1:demo-audit/REQ-002';
const INVALID = { statusCode: 400, bodyKeys: ['error'], code: 'INVALID_REQUEST' };
const CONFLICT = { state: CheckState.Unknown, reasonCode: ReasonCode.AllocationConflict };
/** Both courses listed for one requirement with room for one (GC-ALLOC-001). */
const ONE_SLOT = [
  { candidateCourseIds: [math102.id, phys201.id], remainingCourseCount: 1 },
] as const;

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const app = buildAcademicApp(world);

describe('AC29 course checks carry the engine states unchanged', () => {
  beforeEach(() => {
    resetAcademicWorld(world);
  });

  it('keeps an in-progress prerequisite CONDITIONAL end to end when policy permits (AC02)', async () => {
    resetAcademicWorld(world, {
      attempts: [inProgressAttempt()],
      policy: { allowsInProgressPrerequisites: true },
    });

    const response = await checkCourses(app, { courseIds: [math102.id] });

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          courseResults: [
            {
              courseId: math102.id,
              prerequisite: {
                kind: CheckKind.Prerequisite,
                state: CheckState.Conditional,
                reasonCode: ReasonCode.InProgressMinGrade,
                sourceRef: 'demo-rule-0001',
                evidence: {
                  rulesetVersion: 'demo-2026.1',
                  decisiveLeaves: [
                    {
                      type: 'COURSE',
                      path: [],
                      courseId: math101.id,
                      requiredGrade: { scheme: 'LETTER', value: 'C' },
                      attemptIds: ['60000000-0000-4000-8000-000000000001'],
                      reasonCode: ReasonCode.InProgressMinGrade,
                    },
                  ],
                },
              },
              applicability: {
                kind: CheckKind.RequirementApplicability,
                state: CheckState.Pass,
                sourceRef: REQ_001,
              },
            },
          ],
          setResults: {
            allocation: [{ state: CheckState.Pass }],
            creditLoad: { state: CheckState.Pass },
          },
          aggregate: AggregateState.Conditional,
        },
      },
    });
  });

  it('fails an in-progress prerequisite when policy forbids progression (AC02)', async () => {
    resetAcademicWorld(world, { attempts: [inProgressAttempt()] });

    const response = await checkCourses(app, { courseIds: [math102.id] });

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          courseResults: [
            {
              prerequisite: {
                state: CheckState.Fail,
                reasonCode: ReasonCode.ProgressionNotPermitted,
              },
            },
          ],
          aggregate: AggregateState.Blocked,
        },
      },
    });
  });

  it('names both courses competing for one slot instead of satisfying both (AC05)', async () => {
    resetAcademicWorld(world, { attempts: [completedAttempt()], requirements: ONE_SLOT });

    const response = await checkCourses(app, { courseIds: [math102.id, phys201.id] });

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          setResults: {
            allocation: [
              {
                kind: CheckKind.RequirementAllocation,
                state: CheckState.Unknown,
                reasonCode: ReasonCode.AllocationConflict,
                sourceRef: REQ_001,
                evidence: { courseIds: [math102.id, phys201.id] },
              },
            ],
          },
          aggregate: AggregateState.NeedsVerification,
        },
      },
    });
  });

  it('names both requirements competing for one non-reusable course (AC05)', async () => {
    resetAcademicWorld(world, {
      requirements: [
        { candidateCourseIds: [math102.id] },
        { candidateCourseIds: [math102.id], label: 'Quantitative reasoning' },
      ],
    });

    const response = await checkCourses(app, { courseIds: [math102.id] });

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          setResults: {
            allocation: [
              { ...CONFLICT, sourceRef: REQ_001, evidence: { courseIds: [math102.id] } },
              { ...CONFLICT, sourceRef: REQ_002, evidence: { courseIds: [math102.id] } },
            ],
          },
        },
      },
    });
  });

  it('counts the selected 1.50 credits of a variable-credit course exactly (AC18)', async () => {
    resetAcademicWorld(world, { requirements: [{ candidateCourseIds: [ind390.id] }] });

    const response = await checkCourses(app, {
      courseIds: [ind390.id],
      creditSelections: [{ courseId: ind390.id, selectedCreditsHundredths: 150 }],
    });

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          setResults: {
            creditLoad: {
              kind: CheckKind.CreditLoad,
              state: CheckState.Pass,
              evidence: {
                creditLoad: {
                  totalCreditsHundredths: 150,
                  minCreditsHundredths: 100,
                  maxCreditsHundredths: 1800,
                },
              },
            },
          },
        },
      },
    });
  });

  it('reports an unchosen variable credit as UNKNOWN and never validates the set (AC18)', async () => {
    resetAcademicWorld(world, { requirements: [{ candidateCourseIds: [ind390.id] }] });

    const response = await checkCourses(app, { courseIds: [ind390.id] });

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          setResults: {
            creditLoad: {
              state: CheckState.Unknown,
              reasonCode: ReasonCode.VariableCreditUnselected,
              evidence: { courseIds: [ind390.id], creditLoad: null },
            },
          },
        },
      },
    });
    expect(response.body).not.toMatchObject({ data: { aggregate: AggregateState.Validated } });
    expect(response.body).not.toMatchObject({ data: { aggregate: AggregateState.Conditional } });
  });

  it('returns prerequisite null, not a PASS, for a course with no rule', async () => {
    world.rules = [
      buildPrerequisiteRule(),
      buildPrerequisiteRule({ courseId: phys201.id, rulesetVersion: 'demo-2025.1' }, 2),
    ];

    const response = await checkCourses(app, { courseIds: [phys201.id] });

    expect(response).toMatchObject({
      statusCode: 200,
      body: { data: { courseResults: [{ courseId: phys201.id, prerequisite: null }] } },
    });
  });

  it('refuses a course that is not in the catalog with 400', async () => {
    const response = await checkCourses(app, {
      courseIds: [math102.id, '50000000-0000-4000-8000-000000000999'],
    });

    expect(summarizeError(response)).toMatchObject(INVALID);
  });

  it('refuses a course from another tenant’s catalog with 400', async () => {
    const tenantBCourse = buildCourse({ tenantId: SYNTHETIC_TENANTS.b.id }, 0x777);
    world.courses = [...(world.courses ?? []), tenantBCourse];

    const response = await checkCourses(app, { courseIds: [tenantBCourse.id] });

    expect(summarizeError(response)).toMatchObject(INVALID);
  });
});
