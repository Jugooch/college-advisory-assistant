/**
 * @file Acceptance AC34 (planning/13, ADR-0013 §1-2): revalidating a stale draft appends a new
 * revision and never edits earlier ones. Pending the revalidate endpoint (#410).
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { describe, it } from 'vitest';

describe('AC34 plan draft revalidation appends a revision', () => {
  it.todo(
    'revalidating a stale draft returns 201 with revision 2, cause REVALIDATED, and revision 1 is unchanged (#410)',
  );
  it.todo('the selection carries over only if the identical section set is still offered (#410)');
  it.todo('a withdrawn selected section gives a null selection on the new revision (#410)');
  it.todo('two concurrent revalidations give one 201 and one 409 REVISION_CONFLICT (#410)');
  it.todo(
    'stale current sources give 409 STALE_SOURCE with nothing written and no new revision (#410)',
  );
});
