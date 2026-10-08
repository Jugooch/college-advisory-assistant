/**
 * @file Service tests for policy search with an injected repository fake: the arguments it
 * passes, and a log line with counts only.
 * @requirement FR-16
 * @requirement FR-14
 * @requirement AC42
 */
import { describe, expect, it, vi } from 'vitest';

import type { PolicyDocumentRepository } from '@caa/db';
import { PolicyAudience, Role } from '@caa/domain';
import { buildActor, buildPolicyDocument } from '@caa/test-kit';

import { createRecordingLogger } from '../../testing/in-memory-repositories';
import { createPolicySearchService } from './policy-search.service';

const NOW = new Date('2026-09-01T12:00:00.000Z');

describe('createPolicySearchService', () => {
  it('asks for the session tenant, the role audiences and the clock instant', async () => {
    const listApplicable = vi
      .fn<PolicyDocumentRepository['listApplicable']>()
      .mockResolvedValue([]);
    const service = createPolicySearchService({
      policyDocuments: { listApplicable },
      now: () => NOW,
    });
    const student = buildActor({ roles: [Role.Student] });
    const admin = buildActor({ roles: [Role.Admin] }, 2);
    const context = { logger: createRecordingLogger() };

    await service.search(student, { q: 'x' }, context);
    await service.search(admin, { q: 'x' }, context);

    expect(listApplicable).toHaveBeenNthCalledWith(1, {
      tenantId: student.tenantId,
      audiences: [PolicyAudience.Student, PolicyAudience.All],
      asOf: NOW.toISOString(),
    });
    expect(listApplicable.mock.calls[1]?.[0].audiences).toEqual([
      PolicyAudience.Student,
      PolicyAudience.All,
      PolicyAudience.Advisor,
    ]);
  });

  it('logs the hit count and duration, never the query or text', async () => {
    const document = buildPolicyDocument({ body: 'Secretword text.' });
    const service = createPolicySearchService({
      policyDocuments: { listApplicable: () => Promise.resolve([document]) },
      now: () => NOW,
    });
    const logger = createRecordingLogger();

    const result = await service.search(buildActor(), { q: 'secretword' }, { logger });

    expect(result.hits).toHaveLength(1);
    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]?.details).toMatchObject({ hitCount: 1, durationMs: 0 });
    expect(JSON.stringify(logger.entries)).not.toMatch(/secretword/iu);
  });
});
