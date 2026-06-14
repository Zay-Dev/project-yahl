import type { TAskUserResumeFrom } from '@/shared/transports/-types';

const _formatOptions = (
  options: TAskUserResumeFrom['question']['options'] | undefined,
) =>
  options?.map((option) => `${option.id}=${option.label}`).join(', ') ?? '';

export const buildAskUserResumePrompt = (resumeFrom: TAskUserResumeFrom) => {
  const { answer, question, questionRef } = resumeFrom;
  const optionsText = _formatOptions(question.options);

  const answerLines = answer.freeText?.trim()
    ? [
      `custom free-text answer: ${JSON.stringify(answer.freeText.trim())}`,
      'The user did not pick a preset option; use this free-text value in logic.',
    ]
    : [
      `answer option id: ${JSON.stringify(answer.selectedOptionIds[0] ?? '')}`,
      ...(answer.selectedLabels[0]
        ? [`answer label: ${JSON.stringify(answer.selectedLabels[0])}`]
        : []),
      'Use the option id (not the label) when substituting /ask-user(<id>).',
    ];

  return [
    'Ask-user was answered. Do not call ask_user again. Apply stage.logic with set_context.',
    `questionRef: ${JSON.stringify(questionRef)}`,
    `question: ${JSON.stringify(question.title)}`,
    ...(optionsText ? [`options: ${optionsText}`] : []),
    ...answerLines,
    'Substitute /ask-user(<id>) with JSON.stringify(scalar answer) before set_context.',
  ].join('\n');
};
