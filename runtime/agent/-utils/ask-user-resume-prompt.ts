import type { TAskUserResumeFrom } from '@/shared/transports/-types';

const _formatOptions = (
  options: TAskUserResumeFrom['question']['options'] | undefined,
) =>
  options?.map((option) => `${option.id}=${option.label}`).join(', ') ?? '';

export const buildAskUserResumePrompt = (resumeFrom: TAskUserResumeFrom) => {
  const { answer, question, questionRef } = resumeFrom;
  const optionsText = _formatOptions(question.options);
  const answerKey = `ask_user_${questionRef}_answer`;

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
      `Input context already has ${JSON.stringify(answerKey)} set to that option id.`,
      'Use the option id (not the label) for *answer_of and /ask-user substitution.',
    ];

  return [
    'Ask-user was answered. Do not call ask_user again.',
    'Re-execute the full stage.logic from the first line — the stage is not finished.',
    'Read prior answers with *answer_of(<id>) from Input context.context (already populated).',
    'Complete every produceContextKeys entry via set_context before ending the stage.',
    'Call mastermind for every /mastermind(...) in logic, including persist-knowledge.',
    'When the answer is an option id, resolve typed objects via *matches against context arrays.',
    `questionRef: ${JSON.stringify(questionRef)}`,
    `question: ${JSON.stringify(question.title)}`,
    ...(optionsText ? [`options: ${optionsText}`] : []),
    ...answerLines,
    'Substitute /ask-user(<id>) with JSON.stringify(scalar answer) when that line runs.',
  ].join('\n');
};
