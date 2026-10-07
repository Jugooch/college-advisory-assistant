/**
 * @file Acceptance AC16 (planning/13): "register me" is answered with the saved-plan boundary. No
 * plan response field or value says registered, enrolled or approved, and no enrollment action
 * exists (FR-11). Pending the plan endpoints (#409, #410).
 * @requirement FR-11
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { describe, it } from 'vitest';

describe('AC16 plan responses never claim registration', () => {
  it.todo(
    'no field name or string value in a saved, read or revalidated plan response says registered, enrolled or approved (#409)',
  );
  it.todo(
    'the revalidate response carries no registered, enrolled or approved field or value (#410)',
  );
});
