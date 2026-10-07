/**
 * @file Acceptance AC32 (planning/13, ADR-0013 §1-2): saving a schedule option, or a result with no
 * options, as a plan draft. The stored revision is the server's replay on the pinned inputs, never
 * client evidence. Pending the save endpoint (#409).
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { describe, it } from 'vitest';

describe('AC32 plan draft save replays the pinned inputs', () => {
  it.todo(
    'saving an offered option returns 201 with revision 1, cause SAVED, and the replayed result and pinnedInputs, not client evidence (#409)',
  );
  it.todo(
    'saving a result with no options and a null chosen section set returns 201 with revision 1 (#409)',
  );
  it.todo(
    'a chosen section set that is not one of the replayed options returns 400 with nothing written (#409)',
  );
  it.todo(
    'an input changed between viewing and saving returns 409 REVISION_CONFLICT with nothing written (#409)',
  );
  it.todo(
    'an assigned advisor, another student and another tenant saving get 404 with nothing written (#409)',
  );
  it.todo('a body naming a tenant, user, role or owner returns 400 with nothing written (#409)');
});
