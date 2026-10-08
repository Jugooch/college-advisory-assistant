/**
 * @file Composition root for approved policy search.
 * @module @caa/api/wiring/policy
 * @see docs/adr/0014-api-composition-root-wiring-files.md
 */
import type { ContainerOptions } from '../container';
import {
  createPolicySearchController,
  type PolicySearchController,
} from '../modules/policy-search/policy-search.controller';
import {
  createPolicySearchService,
  type PolicySearchService,
} from '../modules/policy-search/policy-search.service';

/** What {@link wirePolicy} builds. */
export interface PolicyWiring {
  readonly policySearch: PolicySearchController;
  /** The search service, for the conversation tools to reuse. */
  readonly policySearchService: PolicySearchService;
}

/**
 * Builds the policy search service and its controller.
 *
 * @param options - Configuration, repositories, and clock.
 * @returns The controller and the service.
 */
export function wirePolicy(options: ContainerOptions): PolicyWiring {
  const policySearchService = createPolicySearchService({
    policyDocuments: options.repositories.policyDocuments,
    now: options.now,
  });
  return { policySearch: createPolicySearchController(policySearchService), policySearchService };
}
