import type { TYahlStage } from './types';

export const SCRIPT_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

export type TKnowledgeToScriptEligibility = {
  conditionMode?: boolean;
  contextMode?: boolean;
  nixeryRun?: string;
};

export const isAiYahlStage = (stage: TKnowledgeToScriptEligibility): boolean =>
  !stage.contextMode && !stage.conditionMode && !stage.nixeryRun;

export const validateKnowledgeToScriptField = (
  raw: unknown,
  label: string,
  eligibility: TKnowledgeToScriptEligibility,
): boolean | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  if (raw !== true && raw !== false) {
    throw new Error(`${label}.knowledgeToScript: must be true or false when present`);
  }

  if (raw === true && !isAiYahlStage(eligibility)) {
    throw new Error(
      `${label}.knowledgeToScript: cannot enable on contextMode, conditionMode, or nixeryRun stages`,
    );
  }

  return raw;
};

export const isKnowledgeToScriptEnabled = (
  stage: TYahlStage,
): boolean => {
  if (stage.knowledgeToScript === false) {
    return false;
  }

  return isAiYahlStage({
    conditionMode: stage.conditionMode,
    contextMode: stage.contextMode,
    nixeryRun: stage.nixeryRun,
  });
};

export const resolveKnowledgeToScript = isKnowledgeToScriptEnabled;

export const assertScriptId = (scriptId: string, label = 'scriptId'): void => {
  const trimmed = scriptId.trim();

  if (!trimmed || !SCRIPT_ID_PATTERN.test(trimmed)) {
    throw new Error(`${label}: must match ${SCRIPT_ID_PATTERN}`);
  }
};

export const scriptFileName = (
  scriptId: string,
  kind: 'js' | 'meta' | 'recipe',
): string => {
  assertScriptId(scriptId);

  if (kind === 'js') {
    return `${scriptId.trim()}.js`;
  }

  if (kind === 'recipe') {
    return `${scriptId.trim()}.recipe.json`;
  }

  return `${scriptId.trim()}.meta.json`;
};

export const AGENT_SCRIPTS_DIR = '~/data/scripts';
