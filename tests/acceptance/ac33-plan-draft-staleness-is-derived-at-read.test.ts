/**
 * @file Acceptance AC33 (planning/13, ADR-0013 §3): a saved draft reads STALE with each reason
 * after supersession or age, exactly at the maximum age it is CURRENT, and the historical revision
 * is returned unchanged with no current-validity claim. Pending the read endpoint (#409).
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-05
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { describe, it } from 'vitest';

describe('AC33 plan draft staleness is derived at read time', () => {
  it.todo(
    'after a newer student snapshot is stored, freshness is STALE with reason STUDENT_RECORD_SUPERSEDED (#409)',
  );
  it.todo('after a newer audit is stored, freshness is STALE with reason AUDIT_SUPERSEDED (#409)');
  it.todo(
    'after a newer section snapshot is stored, freshness is STALE with reason SECTIONS_SUPERSEDED (#409)',
  );
  it.todo(
    'after the active ruleset version changes, freshness is STALE with reason RULESET_CHANGED (#409)',
  );
  it.todo(
    'after a newer transition table is stored, freshness is STALE with reason TRANSITION_TABLE_CHANGED (#409)',
  );
  it.todo(
    'one millisecond past ACADEMIC_SOURCE_MAX_AGE_MS freshness is STALE with reason SOURCE_EXPIRED (#409)',
  );
  it.todo(
    'exactly at ACADEMIC_SOURCE_MAX_AGE_MS freshness is still CURRENT with no reasons (#409)',
  );
  it.todo(
    'a STALE draft returns the revision unchanged, with its original createdAt and states (#409)',
  );
  it.todo('no field of a STALE or UNKNOWN draft response claims current validity (#409)');
});
