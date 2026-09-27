/**
 * @file Builds synthetic grades for tests, with shorthands for letter and pass/fail grades.
 * @module @caa/test-kit/builders/grade
 */
import {
  createGrade,
  type Grade,
  type GradeInput,
  GradeScheme,
  LetterGrade,
  PassFailGrade,
} from '@caa/domain';

/**
 * Builds a valid grade, defaulting to a letter `B`. A grade has no identity, so this builder
 * takes no seed; pass the whole grade to change it, because the value set depends on the scheme.
 *
 * @param input - The grade to build instead of the default.
 * @returns A validated grade.
 */
export function buildGrade(input: GradeInput = letterInput(LetterGrade.B)): Grade {
  return createGrade(input);
}

/**
 * Builds a letter grade, for example `letter('C')` or `letter(LetterGrade.CMinus)`.
 *
 * @param value - The letter grade.
 * @returns A validated grade under the `LETTER` scheme.
 */
export function letter(value: LetterGrade): Grade {
  return createGrade(letterInput(value));
}

/**
 * Builds a pass/fail `P` grade. `P` is never a letter grade.
 *
 * @returns A validated grade under the `PASS_FAIL` scheme.
 */
export function pass(): Grade {
  return createGrade({ scheme: GradeScheme.PassFail, value: PassFailGrade.Pass });
}

/**
 * Builds a pass/fail `F` grade. For a letter `F`, use `letter('F')`.
 *
 * @returns A validated grade under the `PASS_FAIL` scheme.
 */
export function fail(): Grade {
  return createGrade({ scheme: GradeScheme.PassFail, value: PassFailGrade.Fail });
}

/**
 * Returns the raw input for a letter grade.
 *
 * @param value - The letter grade.
 * @returns Grade input under the `LETTER` scheme.
 */
function letterInput(value: LetterGrade): GradeInput {
  return { scheme: GradeScheme.Letter, value };
}
