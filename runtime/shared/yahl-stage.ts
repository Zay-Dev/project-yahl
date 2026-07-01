export type YahlAskUserOption = {
  description?: string;
  id: string;
  label: string;
};

export type YahlAskUserEntry = {
  answer?: number | string | string[];
  id: string;
  options?: YahlAskUserOption[];
  question: string;
};

export interface YahlStage {
  askUser?: YahlAskUserEntry[];
  conditionMode?: boolean;
  contextKeys?: string[];
  contextMode?: boolean;
  logic: string;
  loopSetup?: string;
  planMode?: boolean;
  produceContextKeys?: string[];
  produceTypeKeys?: string[];
  temperature?: number;
  updateContextKeys?: string[];
  verify?: boolean;
  verifyAutoRetry?: boolean;
  verifyMinScore?: number;
  verifyResume?: boolean;
  verifyRubric?: string;
  version?: number;
}

const LOOP_SETUP_PATTERN = /^\s*for each\s+\w+\s+of\s+\[.*\]\s*$/i;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isAskUserId = (value: unknown): value is number | string =>
  typeof value === "number" && Number.isFinite(value)
  || typeof value === "string" && value.trim().length > 0;

const isAskUserAnswer = (value: unknown): value is number | string | string[] => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return true;
  }

  if (typeof value === "string") {
    return true;
  }

  return isStringArray(value) && value.length > 0;
};

const validateAskUserEntry = (
  raw: unknown,
  label: string,
): YahlAskUserEntry => {
  if (!raw || typeof raw !== "object") {
    throw new Error(`${label}: expected an object`);
  }

  const entry = raw as Record<string, unknown>;

  if (!isAskUserId(entry.id)) {
    throw new Error(`${label}.id: required number or non-empty string`);
  }

  if (typeof entry.question !== "string" || !entry.question.trim()) {
    throw new Error(`${label}.question: required non-empty string`);
  }

  if (entry.answer !== undefined && !isAskUserAnswer(entry.answer)) {
    throw new Error(`${label}.answer: must be a number, string, or non-empty string array when present`);
  }

  if (entry.options !== undefined) {
    if (!Array.isArray(entry.options) || entry.options.length < 2) {
      throw new Error(`${label}.options: must be an array with at least 2 items when present`);
    }

    entry.options.forEach((option, index) => {
      if (!option || typeof option !== "object") {
        throw new Error(`${label}.options[${index}]: expected an object`);
      }

      const item = option as Record<string, unknown>;

      if (typeof item.id !== "string" || !item.id.trim()) {
        throw new Error(`${label}.options[${index}].id: required non-empty string`);
      }

      if (typeof item.label !== "string" || !item.label.trim()) {
        throw new Error(`${label}.options[${index}].label: required non-empty string`);
      }
    });
  }

  return {
    id: String(entry.id).trim(),
    question: entry.question.trim(),
    ...(entry.answer !== undefined
      ? { answer: entry.answer as number | string | string[] }
      : {}),
    ...(Array.isArray(entry.options)
      ? {
        options: entry.options.map((option) => {
          const item = option as Record<string, unknown>;

          return {
            id: String(item.id).trim(),
            label: String(item.label).trim(),
            ...(typeof item.description === "string" && item.description.trim()
              ? { description: item.description.trim() }
              : {}),
          };
        }),
      }
      : {}),
  };
};

const assertStageFields = (stage: Record<string, unknown>, label: string): YahlStage => {
  if (typeof stage.logic !== "string" || !stage.logic.trim()) {
    throw new Error(`${label}.logic: required non-empty string`);
  }

  if (stage.contextMode === true && stage.conditionMode === true) {
    throw new Error(`${label}: contextMode and conditionMode are mutually exclusive`);
  }

  if (stage.conditionMode === true && stage.loopSetup !== undefined) {
    throw new Error(`${label}: conditionMode and loopSetup are mutually exclusive`);
  }

  if (stage.loopSetup !== undefined) {
    if (typeof stage.loopSetup !== "string" || !LOOP_SETUP_PATTERN.test(stage.loopSetup.trim())) {
      throw new Error(`${label}.loopSetup: must match "for each <id> of [...]"`);
    }
  }

  if (stage.temperature !== undefined) {
    const temperature = Number(stage.temperature);

    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      throw new Error(`${label}.temperature: must be a number from 0 to 2`);
    }
  }

  for (const key of [
    "contextKeys",
    "updateContextKeys",
    "produceContextKeys",
    "produceTypeKeys",
  ] as const) {
    if (stage[key] !== undefined && !isStringArray(stage[key])) {
      throw new Error(`${label}.${key}: must be a string array`);
    }
  }

  if (stage.verifyMinScore !== undefined) {
    const score = Number(stage.verifyMinScore);

    if (!Number.isFinite(score) || score < 0 || score > 1) {
      throw new Error(`${label}.verifyMinScore: must be a number from 0 to 1`);
    }
  }

  if (stage.version !== undefined) {
    const version = Number(stage.version);

    if (!Number.isInteger(version) || version < 1) {
      throw new Error(`${label}.version: must be a positive integer`);
    }
  }

  if (stage.conditionMode === true && !stage.logic.includes("IF:")) {
    throw new Error(`${label}: conditionMode logic must contain IF:`);
  }

  let askUser: YahlAskUserEntry[] | undefined;

  if (stage.askUser !== undefined) {
    if (!Array.isArray(stage.askUser) || stage.askUser.length === 0) {
      throw new Error(`${label}.askUser: must be a non-empty array when present`);
    }

    const seenIds = new Set<string>();

    askUser = stage.askUser.map((entry, index) => {
      const validated = validateAskUserEntry(entry, `${label}.askUser[${index}]`);

      if (seenIds.has(validated.id)) {
        throw new Error(`${label}.askUser: duplicate id "${validated.id}"`);
      }

      seenIds.add(validated.id);

      return validated;
    });
  }

  return {
    logic: stage.logic.trim(),
    ...(askUser ? { askUser } : {}),
    ...(stage.contextMode === true ? { contextMode: true } : {}),
    ...(stage.conditionMode === true ? { conditionMode: true } : {}),
    ...(typeof stage.loopSetup === "string" ? { loopSetup: stage.loopSetup.trim() } : {}),
    ...(stage.temperature !== undefined ? { temperature: Number(stage.temperature) } : {}),
    ...(isStringArray(stage.contextKeys) ? { contextKeys: stage.contextKeys } : {}),
    ...(isStringArray(stage.updateContextKeys) ? { updateContextKeys: stage.updateContextKeys } : {}),
    ...(stage.planMode === true ? { planMode: true } : {}),
    ...(isStringArray(stage.produceContextKeys) ? { produceContextKeys: stage.produceContextKeys } : {}),
    ...(isStringArray(stage.produceTypeKeys) ? { produceTypeKeys: stage.produceTypeKeys } : {}),
    ...(stage.verify === true ? { verify: true } : {}),
    ...(stage.verifyAutoRetry === true ? { verifyAutoRetry: true } : {}),
    ...(stage.verifyMinScore !== undefined ? { verifyMinScore: Number(stage.verifyMinScore) } : {}),
    ...(stage.verifyResume === false ? { verifyResume: false } : {}),
    ...(typeof stage.verifyRubric === 'string' ? { verifyRubric: stage.verifyRubric.trim() } : {}),
    ...(stage.version !== undefined ? { version: Number(stage.version) } : {}),
  };
};

export const toAgentStage = (stage: YahlStage): YahlStage => {
  const { loopSetup: _loopSetup, ...rest } = stage;

  return validateYahlStage(rest);
};

export const validateYahlStage = (raw: unknown, index?: number): YahlStage => {
  if (!raw || typeof raw !== "object") {
    throw new Error(index === undefined ? "stage: expected an object" : `stages[${index}]: expected an object`);
  }

  return assertStageFields(
    raw as Record<string, unknown>,
    index === undefined ? "stage" : `stages[${index}]`,
  );
};
