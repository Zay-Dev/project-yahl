import type { TParsedStage } from './types';

const TYPE_DECL_RE = /type\s+(\w+)\s*=\s*([\s\S]*?);/g;

export const isTypesPreambleStage = (stage: TParsedStage, stageIndex: number) => {
  if (stageIndex !== 0) {
    return false;
  }

  const specKeys = Object.keys(stage.spec).filter((key) => {
    const value = stage.spec[key as keyof typeof stage.spec];

    return value !== undefined && value !== null && value !== '';
  });

  if (specKeys.length !== 1 || specKeys[0] !== 'logic') {
    return false;
  }

  return /^\s*type\s+\w+/m.test(stage.spec.logic);
};

export const parseTypesFromPreamble = (logic: string) => {
  const result: Record<string, string> = {};
  const matches = logic.trim().matchAll(TYPE_DECL_RE);

  for (const match of matches) {
    const name = match[1]?.trim();
    const body = match[2]?.trim();

    if (!name || body == null) {
      continue;
    }

    result[name] = `type ${name} = ${body};`;
  }

  return result;
};

export const seedTypesPreamble = (
  types: Map<string, unknown>,
  logic: string,
) => {
  for (const [key, value] of Object.entries(parseTypesFromPreamble(logic))) {
    types.set(key, value);
  }
};
