/**
 * @file Result and input types of prerequisite evaluation: the check and the evidence behind it.
 * @module @caa/engine/verification/prerequisite-evaluation
 * @requirement FR-06
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import type {
  CheckResult,
  CheckState,
  Course,
  CourseAttempt,
  CourseAttemptId,
  CourseId,
  Grade,
  PrerequisiteExpressionType,
  ReasonCode,
} from '@caa/domain';

import type { LeafOutcome } from './evaluate-course-prerequisite';

/** The student's attempts and the catalog that covers them. */
export interface StudentCourseRecord {
  readonly attempts: readonly CourseAttempt[];
  /** Catalog courses; used to find each required course's equivalency group. */
  readonly courses: readonly Course[];
}

/** Common fields of every evaluated leaf. */
interface LeafResultBase {
  /** Child indexes from the root expression to this leaf; `[]` when the root is the leaf. */
  readonly path: readonly number[];
}

/** An evaluated `COURSE` leaf. */
export type CourseLeafResult = LeafResultBase &
  LeafOutcome & {
    readonly type: typeof PrerequisiteExpressionType.Course;
    readonly courseId: CourseId;
    /** The leaf's minimum grade, or `null` when any passing completion satisfies it. */
    readonly requiredGrade: Grade | null;
    /**
     * Every attempt of the course or its equivalents, in input order; empty when the catalog
     * can't place the course.
     */
    readonly attemptIds: readonly CourseAttemptId[];
  };

/** An evaluated `UNSUPPORTED` leaf. It is always UNKNOWN. */
export interface UnsupportedLeafResult extends LeafResultBase {
  readonly type: typeof PrerequisiteExpressionType.Unsupported;
  readonly state: typeof CheckState.Unknown;
  readonly reasonCode: ReasonCode;
  /** The source rule text the parser couldn't represent, verbatim. */
  readonly sourceText: string;
}

/** One evaluated leaf of a prerequisite expression. */
export type PrerequisiteLeafResult = CourseLeafResult | UnsupportedLeafResult;

/** A prerequisite check with the evidence behind it. */
export interface PrerequisiteEvaluation {
  /** Kind PREREQUISITE, the rule's `sourceRef`, and the first decisive leaf's reason code. */
  readonly check: CheckResult;
  /** The course whose prerequisite was evaluated. */
  readonly courseId: CourseId;
  readonly rulesetVersion: string;
  /**
   * The leaves that determined the state, in source order. At each `ALL` or `ANY` node, the
   * decisive leaves are those of every child whose state equals the node's state, so every
   * decisive leaf has the check's state.
   */
  readonly decisiveLeaves: readonly PrerequisiteLeafResult[];
}

/** Thrown when the rule and the academic policy belong to different tenants or rulesets. */
export class PrerequisiteInputMismatchError extends Error {
  /**
   * Creates the error.
   *
   * @param field - The field that differs, `tenantId` or `rulesetVersion`.
   */
  constructor(field: 'tenantId' | 'rulesetVersion') {
    super(`Prerequisite rule and academic policy have different ${field} values`);
    this.name = 'PrerequisiteInputMismatchError';
  }
}
