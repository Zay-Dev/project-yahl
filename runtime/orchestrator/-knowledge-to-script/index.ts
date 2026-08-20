import path from 'path';
import { fileURLToPath } from 'node:url';

import { readFileSync } from 'node:fs';

import { isKnowledgeToScriptEnabled } from '@project-yahl/shared/yahl/knowledge-to-script';
import type { TYahlStage } from '@project-yahl/shared/yahl/types';

import {
  AGENT_SCRIPTS_DIR,
  listScriptIds,
} from './paths';

export {
  AGENT_SCRIPTS_DIR,
  agentScriptPath,
  listScriptArtifacts,
  listScriptIds,
  resolveScriptPath,
  taskScriptsDir,
} from './paths';

export {
  loadScriptMeta,
  parseScriptMeta,
  scriptGoalMet,
  validateScriptOutput,
} from './contract';

export type { TScriptMeta, TScriptOutputContract } from './contract';

export { execNodeScript } from './exec-node-script';

export type { TExecNodeScriptResult } from './exec-node-script';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const knowledgeToScriptPromptPath = path.join(moduleDir, '../YAHL/knowledge-to-script.md');

let cachedPrompt: string | undefined;

const readKnowledgeToScriptPrompt = () => {
  if (cachedPrompt !== undefined) {
    return cachedPrompt;
  }

  try {
    cachedPrompt = readFileSync(knowledgeToScriptPromptPath, 'utf8').trim();
  } catch {
    cachedPrompt = '';
  }

  return cachedPrompt;
};

export const isEnabled = (stage: TYahlStage) => isKnowledgeToScriptEnabled(stage);

export const buildStageSystemAppend = () => {
  const prompt = readKnowledgeToScriptPrompt();

  if (!prompt) {
    return [
      'Operation scripts (knowledgeToScript) are enabled for this AI stage.',
      'Read /opt/skills/knowledge-to-script/SKILL.md once per stage (skip re-read on while polls when already in transcript).',
      `Scripts live under ${AGENT_SCRIPTS_DIR}/ as many narrow ops per stage — not one script per stage id.`,
    ].join('\n');
  }

  return [
    prompt,
    'Read `/opt/skills/knowledge-to-script/SKILL.md` once per stage unless it is already in the transcript (while polls: do not re-read).',
  ].join('\n\n');
};

export const listScriptsDir = listScriptIds;
