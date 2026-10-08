/**
 * @file Composition root for advisor cases: a case freezes a saved plan revision; advisors work
 * the queue and take actions on it.
 * @module @caa/api/wiring/cases
 * @see docs/adr/0014-api-composition-root-wiring-files.md
 */
import type { ContainerOptions } from '../container';
import type { AccessService } from '../modules/access/access.service';
import {
  type CaseActionsController,
  createCaseActionsController,
} from '../modules/case-actions/case-actions.controller';
import { createCaseActionsService } from '../modules/case-actions/case-actions.service';
import { createCaseContextService } from '../modules/case-context/case-context.service';
import {
  type CaseQueueController,
  createCaseQueueController,
} from '../modules/case-queue/case-queue.controller';
import { createCaseQueueService } from '../modules/case-queue/case-queue.service';
import { createCaseViewer } from '../modules/case-viewer/case-viewer.service';
import { type CasesController, createCasesController } from '../modules/cases/cases.controller';
import { createCasesService } from '../modules/cases/cases.service';
import type { PlanViewsService } from '../modules/plan-views/plan-views.service';

/** The controllers for the case routes. */
export interface CasesWiring {
  readonly cases: CasesController;
  readonly caseQueue: CaseQueueController;
  readonly caseActions: CaseActionsController;
}

/**
 * Builds the cases, queue, and actions services and their controllers.
 *
 * @param options - Configuration, repositories, and clock.
 * @param access - The access rule, including who may open a case.
 * @param views - The plan views service the case reads its frozen revision through.
 * @returns The case controllers.
 */
export function wireCases(
  options: ContainerOptions,
  access: AccessService,
  views: PlanViewsService,
): CasesWiring {
  const { repositories, now } = options;
  const { cases, students } = repositories;
  const caseContext = createCaseContextService({ plans: repositories.plans, views });
  const viewCase = createCaseViewer({ students, caseContext });
  return {
    cases: createCasesController(createCasesService({ access, cases, viewCase, caseContext, now })),
    caseQueue: createCaseQueueController(createCaseQueueService({ cases, now })),
    caseActions: createCaseActionsController(
      createCaseActionsService({ access, cases, students, viewCase, now }),
    ),
  };
}
