/**
 * @file Tests for re-rendering stored referral and notice references.
 */
import { describe, expect, it } from 'vitest';

import { AssistantBlockKind, NoticeCode, SpecialistTopic } from '@caa/domain';

import {
  NOTICE_TEMPLATE_IDS,
  PLANNER_INPUT_TEMPLATE_ID,
  renderNotice,
  SOURCE_UNAVAILABLE_TEMPLATE_ID,
  STALE_SOURCE_TEMPLATE_ID,
  TEMPLATE_VERSION,
  TOOL_FAILED_TEMPLATE_ID,
} from './notice.template';
import {
  CRISIS_SUPPORT_REFERRAL,
  CRISIS_TEMPLATE_ID,
  REFERRAL_TEMPLATE_IDS,
  renderReferral,
} from './referral.template';
import { renderStoredTemplateBlock } from './stored-template-block.template';

describe('template ids', () => {
  it('are unique and match the ids the api records today', () => {
    const ids = [
      ...Object.values(NOTICE_TEMPLATE_IDS),
      ...Object.values(REFERRAL_TEMPLATE_IDS),
      CRISIS_SUPPORT_REFERRAL.templateId,
    ];
    expect(new Set(ids).size).toBe(ids.length);
    for (const code of Object.values(NoticeCode)) {
      expect(NOTICE_TEMPLATE_IDS[code]).toBe(`notice.${code.toLowerCase().replaceAll('_', '-')}`);
    }
    for (const topic of Object.values(SpecialistTopic)) {
      expect(REFERRAL_TEMPLATE_IDS[topic]).toBe(
        topic === SpecialistTopic.Crisis
          ? CRISIS_TEMPLATE_ID
          : `referral.${topic.toLowerCase().replaceAll('_', '-')}`,
      );
    }
    expect(TOOL_FAILED_TEMPLATE_ID).toBe('notice.tool-failed');
    expect(PLANNER_INPUT_TEMPLATE_ID).toBe('notice.planner-input-needed');
    expect(STALE_SOURCE_TEMPLATE_ID).toBe('notice.stale-source');
    expect(SOURCE_UNAVAILABLE_TEMPLATE_ID).toBe('notice.source-unavailable');
  });
});

describe('renderStoredTemplateBlock', () => {
  it('returns the live notice block for every notice code at the current version', () => {
    for (const code of Object.values(NoticeCode)) {
      const templateId = NOTICE_TEMPLATE_IDS[code];
      const block = renderStoredTemplateBlock({
        kind: AssistantBlockKind.Notice,
        code,
        templateId,
        templateVersion: TEMPLATE_VERSION,
      });
      expect(block).toEqual({
        kind: AssistantBlockKind.Notice,
        code,
        templateId,
        templateVersion: TEMPLATE_VERSION,
        text: renderNotice(code),
      });
    }
  });

  it('returns the live referral block for every topic at the current version', () => {
    for (const topic of Object.values(SpecialistTopic)) {
      const templateId = REFERRAL_TEMPLATE_IDS[topic];
      const block = renderStoredTemplateBlock({
        kind: AssistantBlockKind.Referral,
        topic,
        templateId,
        templateVersion: TEMPLATE_VERSION,
      });
      expect(block).toEqual({
        kind: AssistantBlockKind.Referral,
        topic,
        templateId,
        templateVersion: TEMPLATE_VERSION,
        text: renderReferral(topic),
      });
    }
  });

  it('returns the tier-2 crisis-support block', () => {
    const block = renderStoredTemplateBlock({
      kind: AssistantBlockKind.Referral,
      topic: SpecialistTopic.Crisis,
      templateId: CRISIS_SUPPORT_REFERRAL.templateId,
      templateVersion: TEMPLATE_VERSION,
    });
    expect(block).toMatchObject({ text: CRISIS_SUPPORT_REFERRAL.text });
  });

  it('returns null for an unknown id, a mismatched code or topic, or an older version', () => {
    const notice = {
      kind: AssistantBlockKind.Notice,
      code: NoticeCode.ToolFailed,
      templateId: TOOL_FAILED_TEMPLATE_ID,
      templateVersion: TEMPLATE_VERSION,
    } as const;
    const referral = {
      kind: AssistantBlockKind.Referral,
      topic: SpecialistTopic.Crisis,
      templateId: CRISIS_TEMPLATE_ID,
      templateVersion: TEMPLATE_VERSION,
    } as const;
    expect(renderStoredTemplateBlock(notice)).not.toBeNull();
    expect(renderStoredTemplateBlock({ ...notice, templateId: 'notice.nope' })).toBeNull();
    expect(renderStoredTemplateBlock({ ...notice, templateVersion: '2020-01-01.1' })).toBeNull();
    expect(
      renderStoredTemplateBlock({ ...notice, templateId: PLANNER_INPUT_TEMPLATE_ID }),
    ).toBeNull();
    expect(renderStoredTemplateBlock({ ...referral, templateId: 'referral.nope' })).toBeNull();
    expect(renderStoredTemplateBlock({ ...referral, templateVersion: 'old' })).toBeNull();
    expect(renderStoredTemplateBlock({ ...referral, topic: SpecialistTopic.Athletics })).toBeNull();
  });

  it('rejects an academic reference kind at compile time', () => {
    const academic = {
      kind: AssistantBlockKind.CasePreview,
      templateId: 'x',
      templateVersion: TEMPLATE_VERSION,
    } as const;
    // @ts-expect-error only NOTICE and REFERRAL references are accepted
    const result = renderStoredTemplateBlock(academic);
    expect(result).toBeNull();
  });
});
