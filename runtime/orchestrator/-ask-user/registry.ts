import type { AskUserBatchToolArguments } from '@/shared/ask-user-batch';
import type { YahlStage } from '@/shared/yahl-stage';

export const resolveAskUserEntry = (
  stage: YahlStage,
  questionRef: string,
) => {
  const trimmed = questionRef.trim();

  return stage.askUser?.find((entry) => String(entry.id) === trimmed) ?? null;
};

export const listAskUserRefs = (stage: YahlStage) =>
  (stage.askUser ?? []).map((entry) => ({
    question: entry.question,
    questionRef: String(entry.id),
  }));

export const validateAskUserToolCall = (
  stage: YahlStage,
  args: AskUserBatchToolArguments,
) => {
  if (!args.batchId?.trim()) {
    return 'ask_user: batchId is required';
  }

  if (!args.title?.trim()) {
    return 'ask_user: title is required';
  }

  if (!Array.isArray(args.questions) || args.questions.length < 1) {
    return 'ask_user: questions must be a non-empty array';
  }

  for (const question of args.questions) {
    const entry = resolveAskUserEntry(stage, question.questionRef);

    if (entry?.answer !== undefined) {
      return `ask_user: question "${question.questionRef}" already answered`;
    }
  }

  return null;
};

export const mergeBatchIntoStage = (
  stage: YahlStage,
  args: AskUserBatchToolArguments,
): YahlStage => {
  const byId = new Map((stage.askUser ?? []).map((entry) => [String(entry.id), entry]));

  for (const question of args.questions) {
    byId.set(question.questionRef, {
      ...(byId.get(question.questionRef) ?? {}),
      id: question.questionRef,
      ...(question.kind === 'multipleChoice' && question.options
        ? { options: question.options }
        : {}),
      question: question.title,
    });
  }

  return {
    ...stage,
    askUser: [...byId.values()],
  };
};
