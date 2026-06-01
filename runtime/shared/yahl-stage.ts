export interface YahlStage {
  conditionMode?: boolean;
  contextKeys?: string[];
  contextMode?: boolean;
  logic: string;
  loopSetup?: string;
  produceContextKeys?: string[];
  produceTypeKeys?: string[];
  temperature?: number;
  updateContextKeys?: string[];
}

const LOOP_SETUP_PATTERN = /^\s*for each\s+\w+\s+of\s+\[.*\]\s*$/i;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

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

  if (stage.conditionMode === true && !stage.logic.includes("IF:")) {
    throw new Error(`${label}: conditionMode logic must contain IF:`);
  }

  return {
    logic: stage.logic.trim(),
    ...(stage.contextMode === true ? { contextMode: true } : {}),
    ...(stage.conditionMode === true ? { conditionMode: true } : {}),
    ...(typeof stage.loopSetup === "string" ? { loopSetup: stage.loopSetup.trim() } : {}),
    ...(stage.temperature !== undefined ? { temperature: Number(stage.temperature) } : {}),
    ...(isStringArray(stage.contextKeys) ? { contextKeys: stage.contextKeys } : {}),
    ...(isStringArray(stage.updateContextKeys) ? { updateContextKeys: stage.updateContextKeys } : {}),
    ...(isStringArray(stage.produceContextKeys) ? { produceContextKeys: stage.produceContextKeys } : {}),
    ...(isStringArray(stage.produceTypeKeys) ? { produceTypeKeys: stage.produceTypeKeys } : {}),
  };
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
