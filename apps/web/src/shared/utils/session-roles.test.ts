/**
 * @file Tests for role checks that decide which links are offered.
 */
import { describe, expect, it } from 'vitest';

import { Role } from '@caa/domain';

import { canReviewCases, isAdminSession } from './session-roles';

describe('canReviewCases', () => {
  it('offers the queue to an advisor and to an admin', () => {
    expect(canReviewCases([Role.Advisor])).toBe(true);
    expect(canReviewCases([Role.Admin])).toBe(true);
    expect(canReviewCases([Role.Student, Role.Advisor])).toBe(true);
  });

  it('does not offer the queue to a student', () => {
    expect(canReviewCases([Role.Student])).toBe(false);
    expect(canReviewCases([])).toBe(false);
  });
});

describe('isAdminSession', () => {
  it('is true only with the admin role', () => {
    expect(isAdminSession([Role.Admin])).toBe(true);
    expect(isAdminSession([Role.Advisor])).toBe(false);
    expect(isAdminSession([Role.Student])).toBe(false);
  });
});
