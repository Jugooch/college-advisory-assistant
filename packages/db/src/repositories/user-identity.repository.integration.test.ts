/**
 * @file Integration tests for the user identity repository against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { IdentityStatus, Role } from '@caa/domain';

import {
  insertTenant,
  insertUser,
  openTestDatabase,
  TEST_ISSUER,
  type TestDatabase,
} from '../testing/integration-fixtures';
import { createUserIdentityRepository } from './user-identity.repository';

describe('UserIdentityRepository', () => {
  let testDatabase: TestDatabase;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  it('finds an identity by issuer and subject, with its own tenant', async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);
    const userId = await insertUser(db, tenantId, 'advisor');

    const identity = await createUserIdentityRepository(db).findByIssuerSubject(
      TEST_ISSUER,
      `synthetic-${tenantId}-advisor`,
    );

    expect(identity).toEqual({
      id: userId,
      tenantId,
      issuer: TEST_ISSUER,
      subject: `synthetic-${tenantId}-advisor`,
      roles: [Role.Advisor],
      status: IdentityStatus.Active,
    });
  });

  it('returns null when the same subject comes from another issuer', async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);
    await insertUser(db, tenantId, 'advisor');

    const identity = await createUserIdentityRepository(db).findByIssuerSubject(
      'https://idp.other.example',
      `synthetic-${tenantId}-advisor`,
    );

    expect(identity).toBeNull();
  });
});
