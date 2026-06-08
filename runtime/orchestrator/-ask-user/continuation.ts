const inlineAskUserRefPattern = /\/ask-user\(question_([^)]+)\)/;

export const toAskUserAnswerValue = (optionId: string | undefined) => {
  if (!optionId) return "";
  const trimmed = optionId.trim();
  if (/^-?(?:\d+|\d*\.\d+)$/.test(trimmed)) {
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) return asNumber;
  }
  return trimmed;
};

export const buildAskUserContinuation = (
  rawLines: string,
  questionRef: string,
  answerValue: number | string,
) => {
  const pattern = new RegExp(
    `/ask-user\\(${questionRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`,
  );
  const splitted = rawLines.split("\n");
  const askUserLineIndex = splitted.findIndex((line) => pattern.test(line));

  if (askUserLineIndex < 0) {
    return null;
  }

  const askUserLine = splitted[askUserLineIndex] || "";
  const serialized = JSON.stringify(answerValue);
  const patchedAskUserLine = askUserLine.replace(pattern, serialized);
  const stageText = [
    ...splitted.slice(0, askUserLineIndex),
    patchedAskUserLine,
    ...splitted.slice(askUserLineIndex + 1),
  ].join("\n");

  return {
    skipNumberOfLines: askUserLineIndex,
    stageText,
  };
};

export const extractAskUserRefsFromLogic = (logic: string) => {
  const refs = new Set<string>();
  const lines = logic.split("\n");

  for (const line of lines) {
    const match = line.match(inlineAskUserRefPattern);

    if (match?.[1]) {
      refs.add(`question_${match[1]}`);
    }
  }

  return [...refs];
};
