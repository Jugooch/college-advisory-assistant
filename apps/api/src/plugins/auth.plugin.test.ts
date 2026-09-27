/**
 * @file Tests for the auth plugin's scoping: public routes stay public and `requireActor` fails closed.
 * @requirement FR-01
 */
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { ErrorCode } from '@caa/domain';
import { buildActor } from '@caa/test-kit';

import { registerAuthenticatedScope, requireActor } from './auth.plugin';
import { registerErrorHandler } from './error-handler.plugin';

const actor = buildActor();
const app = Fastify({ logger: false });
registerErrorHandler(app);
registerAuthenticatedScope(app, {
  sessionResolver: {
    resolve: (token) => Promise.resolve(token === 'dev-token-valid' ? actor : null),
  },
  registerRoutes: (scope) => {
    scope.get('/private', async (request) => requireActor(request));
  },
});
app.get('/public', async (request) => ({ actor: request.actor }));
app.get('/misplaced', async (request) => requireActor(request));

describe('registerAuthenticatedScope', () => {
  it('sets the resolved actor on requests inside the scope', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/private',
      headers: { authorization: 'bearer dev-token-valid' },
    });

    expect(response.json()).toEqual(actor);
  });

  it('leaves routes outside the scope public, with no actor', async () => {
    const response = await app.inject({ method: 'GET', url: '/public' });

    expect(response.json()).toEqual({ actor: null });
  });
});

describe('requireActor', () => {
  it('fails closed with 401 on a route outside the authenticated scope', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/misplaced',
      headers: { authorization: 'Bearer dev-token-valid' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: ErrorCode.Unauthorized } });
  });
});
