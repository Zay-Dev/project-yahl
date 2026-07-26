import type { TAskUserResumeFrom } from '@/shared/transports/-types';

export const buildAskUserResumePrompt = (resumeFrom: TAskUserResumeFrom) => {
  const answerLines = resumeFrom.batchAnswers.flatMap((answer) => {
    const question = resumeFrom.batch.questions.find(
      (item) => item.questionRef === answer.questionRef,
    );
    const answerKey = `ask_user_${answer.questionRef}_answer`;

    if (answer.freeText?.trim()) {
      return [
        `questionRef ${answer.questionRef}: custom free-text answer ${JSON.stringify(answer.freeText.trim())}`,
        `Input context already has ${JSON.stringify(answerKey)} set.`,
      ];
    }

    if (Array.isArray(answer.answerValue)) {
      return [
        `questionRef ${answer.questionRef}: selected option ids ${JSON.stringify(answer.answerValue)}`,
        `Input context already has ${JSON.stringify(answerKey)} set.`,
      ];
    }

    return [
      `questionRef ${answer.questionRef}: answer ${JSON.stringify(answer.answerValue)}`,
      ...(question?.kind === 'multipleChoice'
        ? [`options: ${question.options?.map((option) => `${option.id}=${option.label}`).join(', ') ?? ''}`]
        : []),
      `Input context already has ${JSON.stringify(answerKey)} set.`,
    ];
  });

  return [
    'Ask-user batch was answered. Do not call ask_user again for answered questionRefs.',
    'Re-execute the full stage.logic from the first line — the stage is not finished.',
    'Read prior answers with *answer_of(<id>) from Input context.context (already populated).',
    'Complete every produceContextKeys entry via set_context before ending the stage.',
    'Call mastermind for every /mastermind(...) in logic.',
    'Call nixery for every /nixery(...) in logic.',
    `batchId: ${JSON.stringify(resumeFrom.batch.batchId)}`,
    `batch title: ${JSON.stringify(resumeFrom.batch.title)}`,
    ...answerLines,
  ].join('\n');
};
