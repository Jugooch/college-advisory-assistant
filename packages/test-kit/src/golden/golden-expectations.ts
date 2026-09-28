/**
 * @file Shorthands for the expected checks, decisive leaves, and prohibited claims of golden
 *   cases. They only spell out literal values; nothing here evaluates a rule.
 * @module @caa/test-kit/golden/golden-expectations
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { type z } from 'zod';

import {
  CheckKind,
  CheckState,
  type DecisiveLeafSchema,
  type GradeInput,
  PrerequisiteExpressionType,
  type ReasonCode,
} from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { type ExpectedCheckInput, type ProhibitedClaimInput } from './golden-expectation.schema';
import { GOLDEN_RULE_REF } from './golden-inputs';

/** Expected evidence fields, as accepted by the expectation schema. */
type EvidenceInput = NonNullable<ExpectedCheckInput['evidence']>;

/** A decisive leaf as written in a case, before validation. */
export type DecisiveLeafInput = z.input<typeof DecisiveLeafSchema>;

/**
 * Expects one PREREQUISITE check on the default rule (`demo-rule-0001`).
 *
 * @param state - The expected state.
 * @param reasonCode - The expected reason, `null` for PASS.
 * @param evidence - Evidence fields to compare; omitted fields aren't compared.
 * @returns The expected check.
 */
export function prerequisiteCheck(
  state: CheckState,
  reasonCode: ReasonCode | null,
  evidence?: EvidenceInput,
): ExpectedCheckInput {
  return {
    kind: CheckKind.Prerequisite,
    state,
    reasonCode,
    sourceRef: GOLDEN_RULE_REF,
    ...(evidence === undefined ? {} : { evidence }),
  };
}

/**
 * Expects one check of the given kind.
 *
 * @param kind - The check kind.
 * @param outcome - The state, reason, and optionally the `sourceRef` and evidence.
 * @returns The expected check.
 */
export function expectedCheck(
  kind: CheckKind,
  outcome: Omit<ExpectedCheckInput, 'kind'>,
): ExpectedCheckInput {
  return { kind, ...outcome };
}

/** The literal fields of one expected `COURSE` decisive leaf. */
export interface CourseLeafFields {
  readonly path: readonly number[];
  readonly courseId: string;
  readonly requiredGrade: GradeInput | null;
  /** Seeds of the attempts considered, in input order. */
  readonly attemptSeeds: readonly number[];
  readonly reasonCode: ReasonCode | null;
}

/**
 * Spells out an expected `COURSE` decisive leaf.
 *
 * @param fields - Path, course, required grade, attempt seeds, and reason.
 * @returns The leaf as the domain evidence records it.
 */
export function courseLeaf(fields: CourseLeafFields): DecisiveLeafInput {
  return {
    type: PrerequisiteExpressionType.Course,
    path: fields.path,
    courseId: fields.courseId,
    requiredGrade: fields.requiredGrade,
    attemptIds: fields.attemptSeeds.map((seed) => syntheticId('attempt', seed)),
    reasonCode: fields.reasonCode,
  };
}

/**
 * Prohibits a state with the claim it would wrongly make.
 *
 * @param state - The state no returned check may have.
 * @param claim - What that state would wrongly assert.
 * @returns The prohibited claim.
 */
export function mustNot(state: CheckState, claim: string): ProhibitedClaimInput {
  return { state, claim };
}

/** The claim every UNKNOWN case prohibits first: UNKNOWN is never PASS (CLAUDE.md, planning/08). */
export const NEVER_PASS_WHEN_UNKNOWN = mustNot(
  CheckState.Pass,
  'must not be PASS: missing or undecidable data is never treated as satisfied',
);
