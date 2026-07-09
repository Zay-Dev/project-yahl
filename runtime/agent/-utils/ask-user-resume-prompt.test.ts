import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildAskUserResumePrompt } from './ask-user-resume-prompt';

const baseResumeFrom = () => ({
  batch: {
    batchId: 'round1',
    questions: [{
      kind: 'multipleChoice' as const,
      options: [
        { id: 'hko', label: '香港天文台 (Hong Kong Observatory)' },
        { id: 'other', label: 'Other' },
      ],
      questionRef: 'hk_region',
      title: '你想查詢哪個香港地區的天氣？',
    }],
    title: 'Region',
    version: 'askUserBatch.v1' as const,
  },
  batchAnswers: [{
    answerValue: 'hko',
    questionRef: 'hk_region',
    selectedOptionIds: ['hko'],
  }],
  modelResponses: [],
  pendingToolCallId: 'tool-1',
  toolCalls: [],
});

describe('buildAskUserResumePrompt', () => {
  it('requires full stage re-execution and produceContextKeys completion', () => {
    const prompt = buildAskUserResumePrompt(baseResumeFrom());

    assert.match(prompt, /Do not call ask_user again/);
    assert.match(prompt, /Re-execute the full stage\.logic from the first line/);
    assert.match(prompt, /\*answer_of/);
    assert.match(prompt, /produceContextKeys/);
    assert.match(prompt, /upsert-knowledge-page/);
    assert.match(prompt, /batchId:/);
  });

  it('includes question ref and answer', () => {
    const prompt = buildAskUserResumePrompt(baseResumeFrom());

    assert.match(prompt, /questionRef hk_region/);
    assert.match(prompt, /ask_user_hk_region_answer/);
  });

  it('includes custom free-text answer', () => {
    const prompt = buildAskUserResumePrompt({
      ...baseResumeFrom(),
      batchAnswers: [{
        answerValue: 'maybe later',
        freeText: 'maybe later',
        questionRef: 'hk_region',
      }],
    });

    assert.match(prompt, /custom free-text answer/);
  });
});
