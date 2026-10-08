/**
 * @file Tests for the tools dispatcher: identity smuggled into arguments, the cross-student,
 * cross-tenant and staff refusal, unknown tools, untrusted-data wrapping, and the read-only
 * dependency list.
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-14
 * @requirement AC45
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ToolName } from '@caa/assistant';
import { ErrorCode } from '@caa/domain';

import {
  advisorActor,
  otherStudent,
  otherTenantActor,
  ownPlan,
  setupTools,
} from '../../testing/conversation-tools-harness';
import { scheduleRequest } from '../../testing/schedule-options-harness';

describe('identity and access', () => {
  it("refuses an identity field smuggled into any tool's arguments, with no service call", async () => {
    const { run, getAcademicSummary, search, getPlan } = setupTools();
    const smuggled = { studentId: otherStudent.id, tenantId: 'x', userId: 'y', role: 'ADMIN' };

    for (const name of Object.values(ToolName)) {
      for (const extra of Object.entries(smuggled)) {
        const outcome = await run(name, {
          planId: ownPlan.id,
          query: 'q',
          reason: 'PLAN_REVIEW',
          [extra[0]]: extra[1],
        });
        expect(outcome.errorCode).toBe('INVALID_ARGUMENTS');
      }
    }
    expect(getAcademicSummary).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(getPlan).not.toHaveBeenCalled();
  });

  it("refuses another student's record as NOT_FOUND for every data tool", async () => {
    const { run, getAcademicSummary, search, findOptions } = setupTools();
    const inputs = { studentId: otherStudent.id, plannerInputs: scheduleRequest() };

    for (const [name, args] of [
      [ToolName.GetAcademicSummary, {}],
      [ToolName.SearchApprovedPolicy, { query: 'late' }],
      [ToolName.RequestPlan, {}],
      [ToolName.GetValidationEvidence, { planId: ownPlan.id }],
    ] as const) {
      const outcome = await run(name, args, inputs);
      expect(outcome.errorCode).toBe(ErrorCode.NotFound);
    }
    expect(getAcademicSummary).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(findOptions).not.toHaveBeenCalled();
  });

  it("refuses another tenant's actor and a staff actor as NOT_FOUND", async () => {
    const { run } = setupTools();

    for (const actor of [otherTenantActor, advisorActor]) {
      const outcome = await run(ToolName.GetAcademicSummary, {}, { actor: actor });
      expect(outcome.errorCode).toBe(ErrorCode.NotFound);
      expect(outcome.block).toBeNull();
    }
  });

  it('refuses an unknown tool name', async () => {
    const outcome = await setupTools().run('delete_everything', {});

    expect(outcome.errorCode).toBe('UNKNOWN_TOOL');
    expect(outcome.block).toBeNull();
    expect(outcome.modelText).not.toContain('<tool_data');
  });

  it('imports no case, plan-save, or repository module', () => {
    // SECURITY: no case or plan write is reachable from the tools.
    for (const file of [
      './conversation-tools.service.ts',
      '../conversation-tool-runners/conversation-tool-runners.service.ts',
    ]) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      const imports = [...source.matchAll(/from '(\.\.\/[^']+)'/g)].map((match) => match[1]);

      expect(imports).not.toEqual([]);
      for (const path of imports) {
        expect(path).not.toMatch(
          /case-actions|\/cases\/|plan-drafts|plan-revisions|plan-revalidation|@caa\/db/,
        );
      }
    }
  });
});
