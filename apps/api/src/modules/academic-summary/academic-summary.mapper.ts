/**
 * @file Maps an academic summary to the contract's response fields, and nothing more.
 * @module @caa/api/modules/academic-summary/academic-summary.mapper
 * @requirement FR-02
 * @requirement FR-04
 * @requirement FR-05
 * @see docs/standards/05-api-design.md
 */
import type { AcademicSummaryResponse } from '@caa/api-contract';
import type { RequirementResult } from '@caa/domain';

import type { AcademicSummary } from './academic-summary.service';

/**
 * Picks the requirement fields the contract shows.
 *
 * @param requirement - One audit requirement.
 * @returns The contract's requirement shape, with the audit's own state.
 */
function toSummaryRequirement(
  requirement: RequirementResult,
): AcademicSummaryResponse['requirements'][number] {
  return {
    sourceRequirementId: requirement.sourceRequirementId,
    parentSourceRequirementId: requirement.parentSourceRequirementId,
    label: requirement.label,
    state: requirement.state,
    remainingCreditsHundredths: requirement.remainingCreditsHundredths,
    remainingCourseCount: requirement.remainingCourseCount,
    candidateCourseIds: requirement.candidateCourseIds,
    sourceRef: requirement.sourceRef,
  };
}

/**
 * Maps a summary to the response body of `GET /v1/students/:studentId/academic-summary`.
 *
 * @param summary - The summary the service built.
 * @returns The response body. The audit, both verdicts, and the requirements are all `null` or
 *   empty together, exactly when the student has no audit.
 */
export function toAcademicSummaryResponse(summary: AcademicSummary): AcademicSummaryResponse {
  const { student, studentSnapshot, audit } = summary;
  // SECURITY: data minimization. Only contract fields are copied; tenant, login, attempt, and
  // allocation data stay on the server.
  return {
    student: { id: student.id, sourceStudentId: student.sourceStudentId },
    studentSnapshot: {
      id: studentSnapshot.id,
      programId: studentSnapshot.programId,
      catalogYear: studentSnapshot.catalogYear,
      sourceEffectiveAt: studentSnapshot.sourceEffectiveAt,
    },
    audit:
      audit === null
        ? null
        : {
            auditSource: audit.audit.auditSource,
            auditVersion: audit.audit.auditVersion,
            programId: audit.audit.programId,
            catalogYear: audit.audit.catalogYear,
            generatedAt: audit.audit.generatedAt,
          },
    auditReflectsRecord: audit?.reflectsRecord ?? null,
    programCatalogConsistency: audit?.programCatalogConsistency ?? null,
    requirements: audit?.audit.requirements.map(toSummaryRequirement) ?? [],
  };
}
