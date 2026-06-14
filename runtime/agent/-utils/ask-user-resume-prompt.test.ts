import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildAskUserResumePrompt } from './ask-user-resume-prompt';

const baseResumeFrom = () => ({
  answer: {
    selectedLabels: ['Yes'],
    selectedOptionIds: ['yes'],
  },
  modelResponses: [],
  pendingToolCallId: 'tool-1',
  question: {
    kind: 'multipleChoice' as const,
    options: [
      { id: 'yes', label: 'Yes' },
      { id: 'no', label: 'No' },
    ],
    questionRef: '1',
    title: 'Continue?',
    version: 'askUser.v1' as const,
  },
  questionRef: '1',
  toolCalls: [],
});

describe('buildAskUserResumePrompt', () => {
  it('includes question, options, and option id answer', () => {
    const prompt = buildAskUserResumePrompt(baseResumeFrom());

    assert.match(prompt, /Do not call ask_user again/);
    assert.match(prompt, /questionRef: "1"/);
    assert.match(prompt, /question: "Continue\?"/);
    assert.match(prompt, /options: yes=Yes, no=No/);
    assert.match(prompt, /answer option id: "yes"/);
    assert.match(prompt, /answer label: "Yes"/);
    assert.match(prompt, /JSON\.stringify\(scalar answer\)/);
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
