/**
 * @file Test that the tools wiring builds a service that runs a tool.
 * @requirement FR-01
 */
import { describe, expect, it } from 'vitest';

import { ToolName } from '@caa/assistant';
import { buildActor, buildStudent } from '@caa/test-kit';

import { createRecordingLogger } from '../testing/in-memory-repositories';
import { wireConversationTools } from './conversation-tools.wiring';

describe('wireConversationTools', () => {
  it('builds a service that refuses a student the session does not own', async () => {
    const student = buildStudent({}, 1);
    const service = wireConversationTools({
      access: { canConverse: () => Promise.resolve(false) } as never,
      academicSummary: {} as never,
      policySearch: {} as never,
      scheduleOptions: {} as never,
      planViews: {} as never,
    });

    const outcome = await service.executeTool(
      buildActor(),
      {
        call: { id: 'c1', name: ToolName.GetAcademicSummary, arguments: {} },
        studentId: student.id,
      },
      { logger: createRecordingLogger() },
    );

    expect(outcome.errorCode).toBe('NOT_FOUND');
  });
});
