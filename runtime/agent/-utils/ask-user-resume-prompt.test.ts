import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildAskUserResumePrompt } from './ask-user-resume-prompt';

const baseResumeFrom = () => ({
  answer: {
    selectedLabels: ['HK Observatory (HKO)'],
    selectedOptionIds: ['hko'],
  },
  modelResponses: [],
  pendingToolCallId: 'tool-1',
  question: {
    kind: 'multipleChoice' as const,
    options: [
      { id: 'hko', label: '香港天文台 (Hong Kong Observatory)' },
    ],
    questionRef: 'hk_region',
    title: '你想查詢哪個香港地區的天氣？',
    version: 'askUser.v1' as const,
  },
  questionRef: 'hk_region',
  toolCalls: [],
});

describe('buildAskUserResumePrompt', () => {
  it('requires full stage re-execution and produceContextKeys completion', () => {
    const prompt = buildAskUserResumePrompt(baseResumeFrom());

    assert.match(prompt, /Do not call ask_user again/);
    assert.match(prompt, /Re-execute the full stage\.logic from the first line/);
    assert.match(prompt, /\*answer_of/);
    assert.match(prompt, /produceContextKeys/);
    assert.match(prompt, /persist-knowledge/);
    assert.match(prompt, /\*matches against context arrays/);
  });

  it('includes question, options, and option id answer', () => {
    const prompt = buildAskUserResumePrompt(baseResumeFrom());

    assert.match(prompt, /questionRef: "hk_region"/);
    assert.match(prompt, /answer option id: "hko"/);
    assert.match(prompt, /ask_user_hk_region_answer/);
  });

  it('includes custom free-text answer without option id wording', () => {
    const prompt = buildAskUserResumePrompt({
      ...baseResumeFrom(),
      answer: {
        freeText: 'maybe later',
        selectedLabels: [],
        selectedOptionIds: [],
      },
    });

    assert.match(prompt, /custom free-text answer: "maybe later"/);
    assert.match(prompt, /did not pick a preset option/);
    assert.doesNotMatch(prompt, /answer option id:/);
  });
});
