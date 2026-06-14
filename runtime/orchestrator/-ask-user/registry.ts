import type { AskUserToolCallEnvelope } from '@/shared/stage-contract';
import type { YahlAskUserEntry, YahlStage } from '@/shared/yahl-stage';

export const resolveAskUserEntry = (
  stage: YahlStage,
  questionRef: string,
): YahlAskUserEntry | null => {
  const trimmed = questionRef.trim();

  return stage.askUser?.find((entry) => entry.id === trimmed) ?? null;
};

export const listAskUserRefs = (stage: YahlStage) =>
  (stage.askUser ?? []).map((entry) => ({
    question: entry.question,
    questionRef: entry.id,
  }));

export const validateAskUserToolCall = (
  stage: YahlStage,
  args: AskUserToolCallEnvelope['arguments'],
) => {
  const questionRef = args.questionRef?.trim();

  if (!questionRef) {
    return 'ask_user: questionRef is required';
  }

  const entry = resolveAskUserEntry(stage, questionRef);

  if (!entry) {
    const known = listAskUserRefs(stage)
      .map((item) => item.questionRef)
      .join(', ');

    return known
      ? `ask_user: unknown questionRef "${questionRef}" (expected one of: ${known})`
      : `ask_user: stage has no askUser registry (unknown questionRef "${questionRef}")`;
  }

  if (entry.question !== args.title) {
    return `ask_user: title must match registered question "${entry.question}"`;
  }

  if (entry.options?.length) {
    const presetIds = new Set(entry.options.map((option) => option.id));
    const argIds = new Set(args.options.map((option) => option.id));

    for (const id of presetIds) {
      if (!argIds.has(id)) {
        return `ask_user: missing preset option id "${id}"`;
      }
    }
  }

  return null;
};
