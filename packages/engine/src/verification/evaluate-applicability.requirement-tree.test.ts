/**
 * @file Tests that applicability reads the audit's own states for a candidate and its ancestors.
 */
import { describe, expect, it } from 'vitest';

import type { AuditSnapshot, RequirementResult, RequirementState } from '@caa/domain';
import {
  buildAuditSnapshot,
  buildRequirementResult,
  buildStudentSnapshot,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { evaluateApplicability } from './evaluate-applicability';

const CALC_ID = SYNTHETIC_COURSES.math101.id;
const FRESH = { studentSnapshot: buildStudentSnapshot(), maxSkewMs: 0 };

/** One requirement of a test tree. */
interface Node {
  readonly state: RequirementState;
  /** Whether the requirement lists DEMO-MATH 101 as a candidate. */
  readonly isCandidate: boolean;
  /** Seed of the parent requirement, or `null` for a root. */
  readonly parentSeed: number | null;
}

/**
 * Builds requirement `REQ-00<seed>` from a test node.
 *
 * @param node - The node.
 * @param seed - Drives the requirement ID.
 * @returns The requirement.
 */
function requirementOf(node: Node, seed: number): RequirementResult {
  const remaining = node.state === 'COMPLETE' ? 0 : 1;
  return buildRequirementResult(
    {
      state: node.state,
      parentSourceRequirementId:
        node.parentSeed === null ? null : `REQ-${String(node.parentSeed).padStart(3, '0')}`,
      candidateCourseIds: node.isCandidate ? [CALC_ID] : [],
      remainingCourseCount: remaining,
      remainingCreditsHundredths: remaining * 300,
    },
    seed,
  );
}

/**
 * Builds a chain from a root down to a leaf: each node's parent is the one before it, and only
 * the leaf lists DEMO-MATH 101.
 *
 * @param states - States from the root (`REQ-001`) down to the leaf.
 * @returns The chain's nodes.
 */
function chain(...states: readonly RequirementState[]): readonly Node[] {
  return states.map((state, index) => ({
    state,
    isCandidate: index === states.length - 1,
    parentSeed: index === 0 ? null : index,
  }));
}

/**
 * Evaluates DEMO-MATH 101 against an audit of the given nodes, seeded 1, 2, ... in order.
 *
 * @param nodes - The requirements.
 * @returns The check's state, reason code, and source reference.
 */
function checkOf(nodes: readonly Node[]): unknown {
  const requirements = nodes.map((node, index) => requirementOf(node, index + 1));
  return summarize(buildAuditSnapshot({ requirements }));
}

/**
 * Evaluates DEMO-MATH 101 against an audit and keeps the fields under test.
 *
 * @param audit - The audit.
 * @returns The check's state, reason code, and source reference.
 */
function summarize(audit: AuditSnapshot): unknown {
  const check = evaluateApplicability(CALC_ID, audit, FRESH);
  return { state: check.state, reasonCode: check.reasonCode, sourceRef: check.sourceRef };
}

describe('evaluateApplicability with a closed ancestor', () => {
  it('fails on a COMPLETE parent, naming the parent, though the listing child is INCOMPLETE', () => {
    expect(checkOf(chain('COMPLETE', 'INCOMPLETE'))).toEqual({
      state: 'FAIL',
      reasonCode: 'REQUIREMENT_ALREADY_SATISFIED',
      sourceRef: 'demo-audit:audit_demo_r1:demo-audit/REQ-001',
    });
  });

  it('fails on a COMPLETE grandparent, naming it, above INCOMPLETE requirements', () => {
    expect(checkOf(chain('COMPLETE', 'INCOMPLETE', 'INCOMPLETE'))).toEqual({
      state: 'FAIL',
      reasonCode: 'REQUIREMENT_ALREADY_SATISFIED',
      sourceRef: 'demo-audit:audit_demo_r1:demo-audit/REQ-001',
    });
  });

  it('names the nearest COMPLETE ancestor when several are COMPLETE', () => {
    expect(checkOf(chain('COMPLETE', 'COMPLETE', 'INCOMPLETE'))).toEqual({
      state: 'FAIL',
      reasonCode: 'REQUIREMENT_ALREADY_SATISFIED',
      sourceRef: 'demo-audit:audit_demo_r1:demo-audit/REQ-002',
    });
  });

  it('is UNKNOWN on an AMBIGUOUS parent, naming the parent, above an INCOMPLETE child', () => {
    expect(checkOf(chain('AMBIGUOUS', 'INCOMPLETE'))).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'AUDIT_AMBIGUOUS',
      sourceRef: 'demo-audit:audit_demo_r1:demo-audit/REQ-001',
    });
  });

  it('is UNKNOWN on an AMBIGUOUS grandparent, despite a COMPLETE parent', () => {
    expect(checkOf(chain('AMBIGUOUS', 'COMPLETE', 'INCOMPLETE'))).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'AUDIT_AMBIGUOUS',
      sourceRef: 'demo-audit:audit_demo_r1:demo-audit/REQ-001',
    });
  });

  it('is CONDITIONAL on an IN_PROGRESS parent above an INCOMPLETE child', () => {
    expect(checkOf(chain('IN_PROGRESS', 'INCOMPLETE'))).toEqual({
      state: 'CONDITIONAL',
      reasonCode: 'REQUIREMENT_IN_PROGRESS',
      sourceRef: 'demo-audit:audit_demo_r1:demo-audit/REQ-001',
    });
  });

  it('passes on an outstanding requirement elsewhere, despite a closed ancestor on another', () => {
    const nodes = [
      ...chain('COMPLETE', 'INCOMPLETE'),
      { state: 'INCOMPLETE', isCandidate: true, parentSeed: null } as const,
    ];

    expect(checkOf(nodes)).toEqual({
      state: 'PASS',
      reasonCode: undefined,
      sourceRef: 'demo-audit:audit_demo_r1:demo-audit/REQ-003',
    });
  });
});

describe('evaluateApplicability with outstanding ancestors', () => {
  it('passes on an INCOMPLETE child under INCOMPLETE ancestors, naming the child', () => {
    expect(checkOf(chain('INCOMPLETE', 'INCOMPLETE', 'INCOMPLETE'))).toEqual({
      state: 'PASS',
      reasonCode: undefined,
      sourceRef: 'demo-audit:audit_demo_r1:demo-audit/REQ-003',
    });
  });

  it('passes on an INCOMPLETE parent that lists the course, though its only child is COMPLETE', () => {
    const nodes = [
      { state: 'INCOMPLETE', isCandidate: true, parentSeed: null },
      { state: 'COMPLETE', isCandidate: false, parentSeed: 1 },
    ] as const;

    expect(checkOf(nodes)).toEqual({
      state: 'PASS',
      reasonCode: undefined,
      sourceRef: 'demo-audit:audit_demo_r1:demo-audit/REQ-001',
    });
  });

  it('is UNKNOWN on an AMBIGUOUS child that lists the course, under an INCOMPLETE parent', () => {
    expect(checkOf(chain('INCOMPLETE', 'AMBIGUOUS'))).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'AUDIT_AMBIGUOUS',
      sourceRef: 'demo-audit:audit_demo_r1:demo-audit/REQ-002',
    });
  });

  it('fails with NOT_APPLICABLE when only a child lists an equivalent, not the course', () => {
    const requirements = [
      buildRequirementResult({ candidateCourseIds: [] }, 1),
      buildRequirementResult(
        {
          parentSourceRequirementId: 'REQ-001',
          candidateCourseIds: [SYNTHETIC_COURSES.math111.id],
        },
        2,
      ),
    ];

    expect(summarize(buildAuditSnapshot({ requirements }))).toEqual({
      state: 'FAIL',
      reasonCode: 'NOT_APPLICABLE',
      sourceRef: 'demo-audit:audit_demo_r1',
    });
  });
});

describe('evaluateApplicability with a malformed tree that bypassed the schema', () => {
  const AMBIGUOUS_CHILD = {
    state: 'UNKNOWN',
    reasonCode: 'AUDIT_AMBIGUOUS',
    sourceRef: 'demo-audit:audit_demo_r1:demo-audit/REQ-002',
  };

  it('is UNKNOWN, naming the candidate, when its parent is missing', () => {
    const requirements = [
      buildRequirementResult({ candidateCourseIds: [] }, 1),
      requirementOf({ state: 'INCOMPLETE', isCandidate: true, parentSeed: 9 }, 2),
    ];

    expect(summarize({ ...buildAuditSnapshot(), requirements })).toEqual(AMBIGUOUS_CHILD);
  });

  it('is UNKNOWN, naming the candidate, when its parents form a cycle', () => {
    const requirements = [
      requirementOf({ state: 'INCOMPLETE', isCandidate: false, parentSeed: 2 }, 1),
      requirementOf({ state: 'INCOMPLETE', isCandidate: true, parentSeed: 1 }, 2),
    ];

    expect(summarize({ ...buildAuditSnapshot(), requirements })).toEqual(AMBIGUOUS_CHILD);
  });
});
