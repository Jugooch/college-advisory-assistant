/**
 * @file Proves the persona list builds the `DEV_AUTH_TOKENS` value the API reads.
 * @requirement T08
 * @requirement FR-01
 */
import { describe, expect, it } from 'vitest';

import { devAuthTokensJson } from './personas';

describe('devAuthTokensJson', () => {
  it('maps every persona token to its synthetic issuer and subject', () => {
    expect(JSON.parse(devAuthTokensJson())).toEqual({
      'dev-token-admin': {
        issuer: 'https://idp.synthetic.example',
        subject: 'synthetic-admin-001',
      },
      'dev-token-advisor': {
        issuer: 'https://idp.synthetic.example',
        subject: 'synthetic-advisor-001',
      },
      'dev-token-advisor-2': {
        issuer: 'https://idp.synthetic.example',
        subject: 'synthetic-advisor-002',
      },
      'dev-token-student': {
        issuer: 'https://idp.synthetic.example',
        subject: 'synthetic-student-001',
      },
    });
  });
});
