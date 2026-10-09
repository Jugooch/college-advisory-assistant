/**
 * @file Service tests of the detector blocks with a fake policy search: tier-1 crisis language,
 * a message with no match, and a referral lookup that fails.
 * @requirement FR-10
 * @requirement AC46
 */
import { describe, expect, it, vi } from 'vitest';

import { AssistantBlockKind } from '@caa/domain';
import { buildActor } from '@caa/test-kit';

import { createRecordingLogger } from '../../testing/in-memory-repositories';
import { createConversationBlocksService } from './conversation-blocks.service';

const AT = '2026-09-01T12:00:00.000Z';
const actor = buildActor();

function setup(search = vi.fn().mockResolvedValue({ hits: [], asOf: AT })) {
  const logger = createRecordingLogger();
  const service = createConversationBlocksService({ policySearch: { search } });
  const detect = (message: string) => service.detect(actor, { message, at: AT }, { logger });
  return { detect, search, logger };
}

describe('ConversationBlocksService.detect', () => {
  it('adds nothing for a message that matches no detector', async () => {
    const { detect, search } = setup();

    const result = await detect('Show my academic summary');

    expect(result).toEqual({ blocks: [], isCrisisUnambiguous: false });
    expect(search).not.toHaveBeenCalled();
  });

  it('flags tier-1 crisis language and shows the referral block', async () => {
    const { detect } = setup();

    const result = await detect('I want to kill myself');

    expect(result.isCrisisUnambiguous).toBe(true);
    expect(result.blocks.map((block) => block.kind)).toEqual([AssistantBlockKind.Referral]);
  });

  it('still shows the fixed referral when the referral document lookup fails', async () => {
    const { detect, logger } = setup(vi.fn().mockRejectedValue(new Error('down')));

    const result = await detect('I want to kill myself');

    expect(result.blocks).toHaveLength(1);
    expect(logger.entries.some((entry) => entry.level === 'warn')).toBe(true);
    expect(JSON.stringify(logger.entries)).not.toContain('kill myself');
  });
});
