/**
 * @file Integration tests for reading a conversation's stored last sequence.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { insertTerm } from '../testing/catalog-fixtures';
import {
  insertStudent,
  insertTenant,
  openTestDatabase,
  type TestDatabase,
} from '../testing/integration-fixtures';
import {
  type ConversationRepository,
  type ConversationSequenceReader,
  createConversationRepository,
  type NewConversationTurn,
} from './conversation.repository';

const NOW = '2026-10-08T12:00:00.000Z';
const METADATA = {
  modelId: null,
  promptVersion: 'p1',
  toolSchemaVersion: 't1',
  templateVersion: 'c1',
  guardReasons: [],
  policyRevisions: [],
} as const;
const EXCHANGE: readonly NewConversationTurn[] = [
  { role: 'STUDENT', text: 'hello', createdAt: NOW },
  {
    role: 'ASSISTANT',
    text: 'Here is what I found.',
    blockRefs: [],
    modelStatus: 'ANSWERED',
    metadata: METADATA,
    createdAt: NOW,
  },
];

describe('conversation repository last sequence', () => {
  let testDatabase: TestDatabase;
  let repository: ConversationRepository & ConversationSequenceReader;

  beforeAll(() => {
    testDatabase = openTestDatabase();
    repository = createConversationRepository(testDatabase.db);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const createWorld = async (label: string) => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);
    const termId = await insertTerm(db, tenantId, { termCode: `T-${label}`, sequence: 1 });
    const studentId = await insertStudent(db, tenantId, `S-${label}`);
    const conversation = await repository.findOrCreate({ tenantId, studentId, termId, now: NOW });
    return { tenantId, studentId, conversationId: conversation.id };
  };

  const appendExchange = (
    world: Awaited<ReturnType<typeof createWorld>>,
    expectedSequence: number,
    retainSince = '2026-09-08T12:00:00.000Z',
  ) =>
    repository.appendTurns({
      ...world,
      expectedSequence,
      turns: EXCHANGE,
      retainSince,
      retainCount: 100,
    });

  it('is 0 for a new conversation', async () => {
    const world = await createWorld('new');

    expect(await repository.findLastSequence(world)).toBe(0);
  });

  it('is 2 after one exchange and still 2 after clear', async () => {
    const world = await createWorld('clear');
    await appendExchange(world, 0);
    expect(await repository.findLastSequence(world)).toBe(2);

    await repository.clear(world);

    expect(await repository.findLastSequence(world)).toBe(2);
  });

  it('is unchanged after retention prunes every turn', async () => {
    const world = await createWorld('retain');
    await appendExchange(world, 0);
    await appendExchange(world, 2, '2026-10-09T00:00:00.000Z');

    expect(await repository.listRecent({ ...world, limit: 10 })).toHaveLength(0);
    expect(await repository.findLastSequence(world)).toBe(4);
  });

  it('is null for another student, another tenant, or an unknown conversation', async () => {
    const owner = await createWorld('owner');
    const other = await createWorld('other');
    await appendExchange(owner, 0);

    expect(await repository.findLastSequence({ ...owner, studentId: other.studentId })).toBeNull();
    expect(await repository.findLastSequence({ ...owner, tenantId: other.tenantId })).toBeNull();
    expect(
      await repository.findLastSequence({ ...owner, conversationId: other.conversationId }),
    ).toBeNull();
  });
});
