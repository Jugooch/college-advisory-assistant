/**
 * @file Display data a schedule-options response carries for the term and campuses it names.
 * @module @caa/api-contract/contracts/schedule-display
 * @requirement FR-07
 * @requirement FR-08
 * @requirement NFR-04
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md (Amendment 7)
 */
import { z } from 'zod';

import { CampusSchema, type CheckResult } from '@caa/domain';

/** Field schemas of the domain campus, reused so the contract can't drift from it. */
const CampusFields = CampusSchema.unwrap().shape;

/**
 * The requested term for display. It is the same shape as a plannable term, so the schema is
 * shared rather than copied (ADR-0010 Amendment 7).
 */
export { PlannableTermSchema as ScheduleTermSchema } from './plannable-terms.contract';

/**
 * One campus a response names, for display only.
 *
 * SECURITY: data minimization. `tenantId` and `sourceCampusId` stay on the server. The name is
 * never identity and never feeds the engine, ranking or pinned inputs.
 */
export const CampusDisplaySchema = z
  .object({
    id: CampusFields.id,
    name: CampusFields.name,
  })
  .readonly();

/** One campus a response names. */
export type CampusDisplay = z.infer<typeof CampusDisplaySchema>;

/** The parts of a schedule-options response that can name a campus. */
interface CampusNamingParts {
  readonly options: readonly {
    readonly scheduleFeasibility: CheckResult;
    readonly bundles: readonly {
      readonly sections: readonly { readonly campusId: string | null }[];
    }[];
  }[];
  readonly conflictSet: { readonly items: readonly CheckResult[] } | null;
  readonly unresolved: readonly CheckResult[];
}

/**
 * Lists the campus IDs a response names: every non-null section campus, and both campuses of
 * every transition issue, in the options, the conflict set and `unresolved`.
 *
 * @param response - The response parts that can name a campus.
 * @returns The distinct campus IDs, sorted ascending.
 */
export function namedCampusIds(response: CampusNamingParts): readonly string[] {
  const checks = [
    ...response.options.map((option) => option.scheduleFeasibility),
    ...(response.conflictSet?.items ?? []),
    ...response.unresolved,
  ];
  const ids = new Set<string>([
    ...response.options.flatMap((option) =>
      option.bundles.flatMap((bundle) =>
        bundle.sections.flatMap((section) => (section.campusId === null ? [] : [section.campusId])),
      ),
    ),
    ...checks.flatMap((check) =>
      (check.evidence?.scheduleIssues ?? []).flatMap((issue) =>
        'fromCampusId' in issue ? [issue.fromCampusId, issue.toCampusId] : [],
      ),
    ),
  ]);
  return [...ids].sort();
}

/**
 * Returns whether `campuses` lists exactly the campuses the response names, ordered by `id`
 * with no repeats. An absent list passes while the field is optional.
 *
 * @param response - The response parts that can name a campus, and the campus list.
 * @returns `false` when a named campus is missing, an unnamed one is listed, an ID repeats, or
 *   the list isn't ordered by `id`.
 */
export function hasExactCampuses(
  response: CampusNamingParts & {
    readonly campuses?: readonly { readonly id: string }[] | undefined;
  },
): boolean {
  if (response.campuses === undefined) return true;
  const listed = response.campuses.map((campus) => campus.id);
  const named = namedCampusIds(response);
  return listed.length === named.length && listed.every((id, index) => id === named[index]);
}
