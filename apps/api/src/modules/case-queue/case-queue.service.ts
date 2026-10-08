/**
 * @file Serves the advisor and admin case queue: an advisor sees the cases of students they are
 * assigned to now, an admin also sees the open cases nobody is assigned to. Read-only.
 * @module @caa/api/modules/case-queue/case-queue.service
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-14
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { CaseQueueQuery, CaseQueueResponse } from '@caa/api-contract';
import type { AdvisingCaseRepository } from '@caa/db';
import { type Actor, CaseStatus, Role } from '@caa/domain';

import { NotFoundError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import { toCaseQueueItem } from '../cases/cases.mapper';

/** Dependencies of the case queue service. */
export interface CaseQueueServiceDependencies {
  readonly cases: Pick<AdvisingCaseRepository, 'listQueue' | 'listTenantQueue' | 'listUnrouted'>;
  /** Returns the current time; the instant assignments are evaluated at. */
  readonly now: () => Date;
}

/** The advisor and admin queue. */
export interface CaseQueueService {
  /**
   * Lists the queue, oldest first. An advisor sees the cases of students with an active
   * assignment now. An admin also sees the open cases of students with no active assignment, and
   * may ask for only those with `unrouted`.
   *
   * @param actor - Authenticated actor from the session.
   * @param query - The validated status and unrouted filters.
   * @param context - Request-scoped values.
   * @returns The queue rows, with no note, owner ID or student name.
   * @throws {NotFoundError} When the actor is neither an advisor nor an admin, or a non-admin
   *   asks for the unrouted view.
   * @throws {Error} When an admin reads and the repository has no tenant-wide queue read.
   * @throws {z.ZodError} When a stored case breaks a contract.
   */
  listQueue(
    actor: Actor,
    query: CaseQueueQuery,
    context: RequestContext,
  ): Promise<CaseQueueResponse>;
}

/**
 * Checks that the actor may use the queue and the filters they asked for.
 *
 * @param actor - Authenticated actor from the session.
 * @param query - The validated filters.
 * @returns Whether the actor is an admin.
 * @throws {NotFoundError} When a student, or a non-admin asking for the unrouted view.
 */
function requireQueueAccess(actor: Actor, query: CaseQueueQuery): boolean {
  const isAdmin = actor.roles.includes(Role.Admin);
  // SECURITY: a student sees no queue, and only an admin sees the unrouted view; both are the
  // same NOT_FOUND as a missing route.
  if (!isAdmin && !actor.roles.includes(Role.Advisor)) {
    throw new NotFoundError();
  }
  if (query.unrouted === true && !isAdmin) {
    throw new NotFoundError();
  }
  return isAdmin;
}

/**
 * Reads an admin's rows: every case in the tenant whoever holds it, or only the unrouted open
 * cases when asked.
 *
 * @param cases - Case repository.
 * @param call - The admin, the validated filters, and the instant to evaluate assignments at.
 * @returns The rows, oldest first.
 * @throws {Error} When the repository has no tenant-wide queue read.
 */
async function readAdminRows(
  cases: CaseQueueServiceDependencies['cases'],
  call: { readonly actor: Actor; readonly query: CaseQueueQuery; readonly at: string },
): Promise<CaseQueueResponse['cases']> {
  const { actor, query, at } = call;
  const viewerUserId = actor.userId;
  if (query.unrouted === true) {
    // Unrouted cases are always OPEN, so a filter on another status leaves none of them.
    const isOpen = query.status === undefined || query.status === CaseStatus.Open;
    const found = isOpen ? await cases.listUnrouted(actor.tenantId, at) : [];
    return found.map((entry) => toCaseQueueItem(entry, { viewerUserId, routed: false }));
  }
  const filter = { at, ...(query.status === undefined ? {} : { status: query.status }) };
  // TODO(#468): the interface method becomes required once the QA fake implements it.
  if (cases.listTenantQueue === undefined) {
    // Fail closed: an empty queue would hide cases from the admin who must see them.
    throw new Error('the case repository does not implement listTenantQueue');
  }
  const entries = await cases.listTenantQueue(actor.tenantId, filter);
  return entries
    .filter((entry) => query.unrouted !== false || entry.routed)
    .map((entry) => toCaseQueueItem(entry, { viewerUserId, routed: entry.routed }));
}

/**
 * Creates the case queue service.
 *
 * @param dependencies - Case repository and clock.
 * @returns A {@link CaseQueueService}.
 */
export function createCaseQueueService(
  dependencies: CaseQueueServiceDependencies,
): CaseQueueService {
  const { cases } = dependencies;
  return {
    async listQueue(actor, query, context) {
      const isAdmin = requireQueueAccess(actor, query);
      const at = dependencies.now().toISOString();
      const viewerUserId = actor.userId;
      // SECURITY: an admin reads the tenant (session tenant); an advisor reads only the cases of
      // students they hold an active assignment to.
      const found = isAdmin
        ? await readAdminRows(cases, { actor, query, at })
        : (
            await cases.listQueue(actor.tenantId, viewerUserId, {
              at,
              ...(query.status === undefined ? {} : { status: query.status }),
            })
          ).map((entry) => toCaseQueueItem(entry, { viewerUserId, routed: true }));
      const rows = found.toSorted(
        (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
      );
      context.logger.info(
        {
          actorUserId: actor.userId,
          tenantId: actor.tenantId,
          count: rows.length,
          status: query.status ?? null,
          unrouted: query.unrouted ?? null,
        },
        'advisor case queue read',
      );
      return { cases: rows };
    },
  };
}
