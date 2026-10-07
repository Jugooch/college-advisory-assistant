/**
 * @file Evaluates a prerequisite rule's AND/OR expression against a student's course record.
 * @module @caa/engine/verification/evaluate-prerequisite
 * @requirement FR-06
 * @requirement FR-09
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  CheckKind,
  type CheckResult,
  CheckState,
  type CourseId,
  createCheckResult,
  type DecisiveLeaf,
  type PrerequisiteExpression,
  PrerequisiteExpressionType,
  type PrerequisiteRootExpression,
  type PrerequisiteRule,
  ReasonCode,
} from '@caa/domain';

import { combineAllStates, combineAnyStates } from './combine-prerequisite-states';
import { evaluateCoursePrerequisite, type LeafOutcome } from './evaluate-course-prerequisite';
import {
  PrerequisiteInputMismatchError,
  type StudentCourseRecord,
} from './prerequisite-evaluation';
import { type AttemptGroup, resolveAttempts } from './resolve-attempts';
import type { AttemptResolutionContext } from './select-counting-attempt';

/**
 * An evaluated node: its state and the leaves that decided it. Every decisive leaf has the
 * node's state, so the leaves carry no state of their own (check-evidence.model.ts).
 */
interface NodeResult {
  readonly state: CheckState;
  readonly decisiveLeaves: readonly DecisiveLeaf[];
}

/** Finds the attempt group of a required course, or reports that the catalog can't say. */
type GroupLookup = (courseId: CourseId) => { readonly group: AttemptGroup | null } | null;

/** Everything a node needs besides itself, fixed for one evaluation. */
interface NodeEnvironment {
  readonly findGroup: GroupLookup;
  readonly context: AttemptResolutionContext;
}

/**
 * A prerequisite rule whose expression may be an explicit "no prerequisite" at the root
 * (ADR-0012 §1). Every {@link PrerequisiteRule} is one.
 */
export type RootPrerequisiteRule = Omit<PrerequisiteRule, 'expression'> & {
  readonly expression: PrerequisiteRootExpression;
};

const CATALOG_GAP: LeafOutcome = {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.CourseNotInCatalog,
};

/**
 * Evaluates a prerequisite rule against a student's attempts with three-valued logic. A `NONE`
 * root passes with no decisive leaves, whatever the attempts and catalog hold. `ALL`
 * and `ANY` combine their children as documented in `combine-prerequisite-states.ts`; each
 * `COURSE` leaf is decided by `evaluateCoursePrerequisite` from the counting attempt of the
 * course's equivalency group; an `UNSUPPORTED` leaf is UNKNOWN with its own reason code.
 *
 * The same inputs always give a deep-equal result: nothing depends on the clock, randomness,
 * or iteration order other than the inputs' own order.
 *
 * @param rule - The prerequisite rule, with its `sourceRef` and `rulesetVersion`.
 * @param record - The student's attempts and the catalog covering them. Attempts are resolved
 *   here, with the same catalog used to find each required course's equivalents.
 * @param context - The academic policy of the rule's tenant and ruleset, and the term order.
 * @returns A PREREQUISITE check with the rule's `sourceRef`, the first decisive leaf's reason
 *   code, and evidence holding the rule's `rulesetVersion` and the decisive leaves.
 * @throws {PrerequisiteInputMismatchError} When the policy's tenant or ruleset differs from
 *   the rule's.
 */
export function evaluatePrerequisite(
  rule: RootPrerequisiteRule,
  record: StudentCourseRecord,
  context: AttemptResolutionContext,
): CheckResult {
  // SAFETY: a rule interpreted under another ruleset's policy mixes snapshots, so the result
  // wouldn't be reproducible evidence (planning/08 §Rule lifecycle; AC09, AC10).
  if (rule.tenantId !== context.academicPolicy.tenantId) {
    throw new PrerequisiteInputMismatchError('tenantId');
  }
  if (rule.rulesetVersion !== context.academicPolicy.rulesetVersion) {
    throw new PrerequisiteInputMismatchError('rulesetVersion');
  }
  const { expression } = rule;
  if (expression.type === PrerequisiteExpressionType.None) {
    // SAFETY: the institution states the course has no prerequisite, so nothing in the record
    // can block it; the rule's source is the evidence (ADR-0012 §1; planning/08 §Eligibility
    // semantics). A course with no rule at all is UNKNOWN instead (missing-prerequisite-rule.ts).
    return createCheckResult({
      kind: CheckKind.Prerequisite,
      state: CheckState.Pass,
      sourceRef: rule.sourceRef,
      evidence: { rulesetVersion: rule.rulesetVersion, decisiveLeaves: [] },
    });
  }
  const findGroup = createGroupLookup(record, context);
  const root = evaluateNode(expression, [], { findGroup, context });
  const [first] = root.decisiveLeaves;
  // NOTE: an empty group is the only way a non-PASS state has no decisive leaf; the domain
  // rejects empty groups, so the fallback reason is defensive.
  const reasonCode = first?.reasonCode ?? ReasonCode.UnsupportedRule;
  return createCheckResult({
    kind: CheckKind.Prerequisite,
    state: root.state,
    sourceRef: rule.sourceRef,
    ...(root.state === CheckState.Pass ? {} : { reasonCode }),
    evidence: { rulesetVersion: rule.rulesetVersion, decisiveLeaves: root.decisiveLeaves },
  });
}

/**
 * Resolves the student's attempts and builds the lookup from a required course to its group.
 *
 * @param record - The student's attempts and the catalog.
 * @param context - The attempt resolution context.
 * @returns A lookup giving the course's group (`null` when it has no attempts), or `null` when
 *   the catalog can't place the course or some attempted course.
 */
function createGroupLookup(
  record: StudentCourseRecord,
  context: AttemptResolutionContext,
): GroupLookup {
  const groups = resolveAttempts(record.attempts, record.courses, context);
  const courseById = new Map(record.courses.map((course) => [course.id, course]));
  const isCatalogComplete = record.attempts.every((attempt) => courseById.has(attempt.courseId));
  return (courseId) => {
    const course = courseById.get(courseId);
    // SAFETY: without the required course in the catalog its equivalents are unknown, and an
    // uncatalogued attempt could be one of them, so "no attempt" can't be concluded
    // (planning/08 §Candidate formation: stable equivalency groups).
    if (course === undefined || !isCatalogComplete) {
      return null;
    }
    const { equivalencyGroupId } = course;
    const group = groups.find((candidate) =>
      equivalencyGroupId === null
        ? candidate.equivalencyGroupId === null && candidate.courseIds.includes(courseId)
        : candidate.equivalencyGroupId === equivalencyGroupId,
    );
    return { group: group ?? null };
  };
}

/**
 * Evaluates one node of the expression tree.
 *
 * @param node - The node.
 * @param path - Child indexes from the root to this node.
 * @param environment - The group lookup and the attempt resolution context.
 * @returns The node's state and decisive leaves.
 */
function evaluateNode(
  node: PrerequisiteExpression,
  path: readonly number[],
  environment: NodeEnvironment,
): NodeResult {
  if (node.type === PrerequisiteExpressionType.Course) {
    const lookup = environment.findGroup(node.courseId);
    const outcome =
      lookup === null
        ? CATALOG_GAP
        : evaluateCoursePrerequisite(node, lookup.group, environment.context);
    const leaf: DecisiveLeaf = {
      type: node.type,
      path,
      courseId: node.courseId,
      requiredGrade: node.minimumGrade,
      attemptIds: lookup?.group?.attempts.map((attempt) => attempt.id) ?? [],
      reasonCode: outcome.reasonCode,
    };
    return { state: outcome.state, decisiveLeaves: [leaf] };
  }
  if (node.type === PrerequisiteExpressionType.Unsupported) {
    // SAFETY: semantics the parser couldn't represent are UNKNOWN, never PASS (planning/08
    // §Eligibility semantics: approved source semantics).
    const leaf: DecisiveLeaf = {
      type: node.type,
      path,
      sourceText: node.sourceText,
      reasonCode: node.reasonCode,
    };
    return { state: CheckState.Unknown, decisiveLeaves: [leaf] };
  }
  const children = node.items.map((item, index) =>
    evaluateNode(item, [...path, index], environment),
  );
  const states = children.map((child) => child.state);
  // SAFETY: the children's states are combined without collapsing UNKNOWN or CONDITIONAL, so
  // an OR stays a set of alternatives, never a list of compulsory courses (planning/08
  // §Eligibility semantics).
  const state =
    node.type === PrerequisiteExpressionType.All
      ? combineAllStates(states)
      : combineAnyStates(states);
  return {
    state,
    decisiveLeaves: children
      .filter((child) => child.state === state)
      .flatMap((child) => child.decisiveLeaves),
  };
}
