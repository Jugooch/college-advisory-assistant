/**
 * @file Composition root for the conversation tools: binds the six tools to the read services
 * they call. The turn endpoint takes the service from here.
 * @module @caa/api/wiring/conversation-tools
 * @see docs/adr/0014-api-composition-root-wiring-files.md
 */
import type { AcademicSummaryService } from '../modules/academic-summary/academic-summary.service';
import type { AccessService } from '../modules/access/access.service';
import { createConversationToolRunnersService } from '../modules/conversation-tool-runners/conversation-tool-runners.service';
import {
  type ConversationToolsService,
  createConversationToolsService,
} from '../modules/conversation-tools/conversation-tools.service';
import type { PlanViewsService } from '../modules/plan-views/plan-views.service';
import type { PolicySearchService } from '../modules/policy-search/policy-search.service';
import type { ScheduleOptionsService } from '../modules/schedule-options/schedule-options.service';

/** The services the tools read through. */
export interface ConversationToolsSources {
  readonly access: AccessService;
  readonly academicSummary: AcademicSummaryService;
  readonly policySearch: PolicySearchService;
  readonly scheduleOptions: ScheduleOptionsService;
  readonly planViews: PlanViewsService;
}

/**
 * Builds the conversation tools service.
 *
 * @param sources - The access rule and the read services.
 * @returns The tools service.
 */
export function wireConversationTools(sources: ConversationToolsSources): ConversationToolsService {
  return createConversationToolsService({
    access: sources.access,
    runners: createConversationToolRunnersService(sources),
  });
}
