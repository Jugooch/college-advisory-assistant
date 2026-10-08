/**
 * @file Composition root for the academic reads: summary, course checks, schedule options, and
 * plannable terms.
 * @module @caa/api/wiring/academic
 * @see docs/adr/0014-api-composition-root-wiring-files.md
 */
import type { ContainerOptions } from '../container';
import {
  type AcademicSummaryController,
  createAcademicSummaryController,
} from '../modules/academic-summary/academic-summary.controller';
import {
  type AcademicSummaryService,
  createAcademicSummaryService,
} from '../modules/academic-summary/academic-summary.service';
import type { AccessService } from '../modules/access/access.service';
import {
  type CourseChecksController,
  createCourseChecksController,
} from '../modules/course-checks/course-checks.controller';
import { createCourseChecksService } from '../modules/course-checks/course-checks.service';
import { createCourseSetInputsService } from '../modules/course-set-inputs/course-set-inputs.service';
import { createPinnedRecordsService } from '../modules/pinned-records/pinned-records.service';
import { createPinnedSectionsService } from '../modules/pinned-sections/pinned-sections.service';
import {
  createPlannableTermsController,
  type PlannableTermsController,
} from '../modules/plannable-terms/plannable-terms.controller';
import { createPlannableTermsService } from '../modules/plannable-terms/plannable-terms.service';
import {
  createScheduleOptionsController,
  type ScheduleOptionsController,
} from '../modules/schedule-options/schedule-options.controller';
import {
  createScheduleOptionsService,
  type ScheduleOptionsService,
} from '../modules/schedule-options/schedule-options.service';
import type { StudentsService } from '../modules/students/students.service';

/** What {@link wireAcademic} builds: the academic controllers and the schedule options service. */
export interface AcademicWiring {
  readonly academicSummary: AcademicSummaryController;
  readonly courseChecks: CourseChecksController;
  readonly scheduleOptions: ScheduleOptionsController;
  readonly plannableTerms: PlannableTermsController;
  /** The service plan saves replay, built once here. */
  readonly scheduleOptionsService: ScheduleOptionsService;
  /** The academic summary service, shared with the conversation tools. */
  readonly academicSummaryService: AcademicSummaryService;
}

/**
 * Builds the academic read services and their controllers.
 *
 * @param options - Configuration, repositories, and clock.
 * @param studentsService - Applies the access rule every academic read starts with.
 * @param access - The access rule.
 * @returns The academic controllers and the schedule options service.
 */
export function wireAcademic(
  options: ContainerOptions,
  studentsService: StudentsService,
  access: AccessService,
): AcademicWiring {
  const { env, repositories, now } = options;
  const pinnedRecords = createPinnedRecordsService({
    studentSnapshots: repositories.studentSnapshots,
    auditSnapshots: repositories.auditSnapshots,
    now,
    maxSourceAgeMs: env.ACADEMIC_SOURCE_MAX_AGE_MS,
  });
  const courseSetInputs = createCourseSetInputsService({
    students: studentsService,
    pinnedRecords,
    pinnedSections: createPinnedSectionsService({
      sectionSnapshots: repositories.sectionSnapshots,
      campusTransitions: repositories.campusTransitions,
      pinnedRecords,
    }),
    courseCatalog: repositories.courseCatalog,
    prerequisiteRules: repositories.prerequisiteRules,
    academicPolicies: repositories.academicPolicies,
    terms: repositories.terms,
    maxSkewMs: env.AUDIT_RECORD_MAX_SKEW_MS,
    rulesetVersion: env.ACTIVE_RULESET_VERSION ?? null,
  });
  const scheduleOptionsService = createScheduleOptionsService({
    courseSetInputs,
    campuses: repositories.campuses,
    now,
    workCap: env.SCHEDULE_SOLVER_WORK_CAP,
  });
  const academicSummaryService = createAcademicSummaryService({
    students: studentsService,
    pinnedRecords,
    maxSkewMs: env.AUDIT_RECORD_MAX_SKEW_MS,
    courseCatalog: repositories.courseCatalog,
    programs: repositories.programs,
  });
  return {
    academicSummary: createAcademicSummaryController(academicSummaryService),
    courseChecks: createCourseChecksController(createCourseChecksService({ courseSetInputs })),
    scheduleOptions: createScheduleOptionsController(scheduleOptionsService),
    plannableTerms: createPlannableTermsController(
      createPlannableTermsService({
        access,
        sectionSnapshots: repositories.sectionSnapshots,
        now,
        maxSourceAgeMs: env.ACADEMIC_SOURCE_MAX_AGE_MS,
      }),
    ),
    scheduleOptionsService,
    academicSummaryService,
  };
}
