/**
 * @file Every table, collected for drizzle-kit and the typed client.
 * @module @caa/db/schema
 */
export { academicPolicyTable } from './tables/academic-policy.table';
export { advisorAssignmentTable } from './tables/advisor-assignment.table';
export { auditSnapshotTable } from './tables/audit-snapshot.table';
export { campusTable } from './tables/campus.table';
export {
  campusTransitionTable,
  campusTransitionVersionTable,
} from './tables/campus-transition.table';
export { courseTable } from './tables/course.table';
export { courseAttemptTable } from './tables/course-attempt.table';
export { equivalencyGroupTable } from './tables/equivalency-group.table';
export { importBatchTable } from './tables/import-batch.table';
export { importQuarantineTable } from './tables/import-quarantine.table';
export { institutionTable } from './tables/institution.table';
export { prerequisiteRuleTable } from './tables/prerequisite-rule.table';
export { programTable } from './tables/program.table';
export { requirementResultTable } from './tables/requirement-result.table';
export { requirementResultAllocatedAttemptTable } from './tables/requirement-result-allocated-attempt.table';
export { requirementResultCandidateCourseTable } from './tables/requirement-result-candidate-course.table';
export { sectionTable } from './tables/section.table';
export {
  sectionLinkComponentTable,
  sectionLinkGroupTable,
  sectionLinkMemberTable,
} from './tables/section-link-group.table';
export { sectionMeetingTable } from './tables/section-meeting.table';
export { sectionSnapshotTable } from './tables/section-snapshot.table';
export { studentTable } from './tables/student.table';
export { studentSnapshotTable } from './tables/student-snapshot.table';
export { studentSnapshotAttemptTable } from './tables/student-snapshot-attempt.table';
export { termTable } from './tables/term.table';
export { userIdentityTable } from './tables/user-identity.table';
