/**
 * @file Where a signed-in student's own record is, from the student the API linked to the session.
 * @module @caa/web/features/session/utils/own-record
 * @requirement FR-01
 * @requirement FR-02
 */
import type { MeResponse } from '@caa/api-contract';

/**
 * Returns the path of the signed-in user's own overview.
 *
 * @param me - Who the API resolved the session to.
 * @returns `/overview?studentId=<id>` when the API linked a student to the session, or null when
 *   it linked none or didn't report one (then the lookup form stays).
 */
export function ownOverviewPath(me: MeResponse): string | null {
  // SECURITY: the student comes from the server-resolved session, never from the request.
  // NOTE: one check covers both a `null` ID and one an older API doesn't send.
  const studentId = me.studentId ?? null;
  if (studentId === null) {
    return null;
  }
  return `/overview?${new URLSearchParams({ studentId }).toString()}`;
}
