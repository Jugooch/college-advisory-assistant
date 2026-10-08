/**
 * @file What the signed-in roles allow the screens to offer. Only a convenience for navigation:
 * the API enforces every role check again on each request.
 * @module @caa/web/shared/utils/session-roles
 * @requirement FR-01
 * @requirement FR-12
 */
import { Role } from '@caa/domain';

/**
 * Returns whether the roles include the advisor or the admin role, so the review queue is offered.
 *
 * @param roles - The roles the API reported for the session.
 * @returns `true` for an advisor or an admin; `false` for a student-only session.
 */
export function canReviewCases(roles: readonly Role[]): boolean {
  // SECURITY: this only decides whether a link is shown. The server still refuses a student.
  return roles.includes(Role.Advisor) || roles.includes(Role.Admin);
}

/**
 * Returns whether the roles include the admin role, so the admin-only "Unrouted" filter is offered.
 *
 * @param roles - The roles the API reported for the session.
 * @returns `true` for an admin.
 */
export function isAdminSession(roles: readonly Role[]): boolean {
  // SECURITY: the API answers 404 to an advisor who asks for the unrouted view anyway.
  return roles.includes(Role.Admin);
}
