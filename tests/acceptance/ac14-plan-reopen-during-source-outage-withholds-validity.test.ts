/**
 * @file Acceptance AC14 (planning/13, ADR-0013 §3): a source outage during plan reopen shows the
 * historical plan and withholds current validity. Pending the read endpoint (#409).
 * @requirement FR-02
 * @requirement NFR-05
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { describe, it } from 'vitest';

describe('AC14 plan reopen during a source outage', () => {
  it.todo(
    'with a current source unreadable, reading the draft returns 200 with freshness UNKNOWN and reason SOURCE_UNAVAILABLE, never CURRENT (#409)',
  );
  it.todo(
    'with a current source unreadable, the historical revision is still returned in full with its original createdAt and states (#409)',
  );
});
