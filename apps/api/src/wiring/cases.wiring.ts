/**
 * @file Composition root for advisor cases: a case freezes a saved plan revision.
 * @module @caa/api/wiring/cases
 * @see docs/adr/0014-api-composition-root-wiring-files.md
 */
import type { ContainerOptions } from '../container';
import type { AccessService } from '../modules/access/access.service';
import { createCaseContextService } from '../modules/case-context/case-context.service';
import { type CasesController, createCasesController } from '../modules/cases/cases.controller';
import { createCasesService } from '../modules/cases/cases.service';
import type { PlanViewsService } from '../modules/plan-views/plan-views.service';

/**
 * Builds the cases service and its controller.
 *
 * @param options - Configuration, repositories, and clock.
 * @param access - The access rule, including who may open a case.
 * @param views - The plan views service the case reads its frozen revision through.
 * @returns The cases controller.
 */
export function wireCases(
  options: ContainerOptions,
  access: AccessService,
  views: PlanViewsService,
): CasesController {
  const { repositories, now } = options;
  const caseContext = createCaseContextService({ plans: repositories.plans, views });
  return createCasesController(
    createCasesService({
      access,
      cases: repositories.cases,
      students: repositories.students,
      caseContext,
      now,
    }),
  );
}
