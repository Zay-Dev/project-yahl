import YAML from 'yaml';

import type { TParsedStage } from './types';
import type { TYahlDocument } from './document-schema';
import { validateYahlDocument } from './document-schema';
import { compileStage } from './stage-compile';
import type { TYahlStage } from './types';

const findLogicSourceLine = (fileText: string, stageIndex: number) => {
  const lines = fileText.split(/\r?\n/);
  let seenStages = -1;
  let inStages = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';

    if (/^\s*stages:\s*$/.test(line)) {
      inStages = true;
      continue;
    }

    if (!inStages) continue;

    if (/^\s*-\s/.test(line)) {
      seenStages += 1;
    }

    if (seenStages === stageIndex && /^\s*logic:\s*(?:\||>)?\s*$/.test(line)) {
      return i + 2;
    }

    if (seenStages === stageIndex && /^\s*logic:\s*\S/.test(line)) {
      return i + 1;
    }
  }

  return 1;
};

const findTypesSourceLine = (fileText: string) => {
  const index = fileText.split(/\r?\n/).findIndex((line) => /^\s*types:\s*(?:\||>)?\s*$/.test(line));

  return index >= 0 ? index + 2 : 1;
};

const wrapPlainLogic = (logic: string) => {
  const trimmed = logic.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('IF:')) {
    return logic;
  }

  return `{\n${logic}\n}`;
};

const buildStagesFromDocument = (document: TYahlDocument, text: string): TParsedStage[] => {
  const stages: TParsedStage[] = [];

  if (document.types) {
    const typesSpec: TYahlStage = { logic: document.types };

    stages.push({
      lines: wrapPlainLogic(document.types),
      sourceStartLine: findTypesSourceLine(text),
      spec: typesSpec,
      type: 'plain',
    });
  }

  document.stages.forEach((stage, index) => {
    stages.push(compileStage(stage, findLogicSourceLine(text, index)));
  });

  return stages;
};

export const parseYahlDocument = (text: string): TYahlDocument => {
  const parsed = YAML.parse(text);

  return validateYahlDocument(parsed);
};

export const parseYahlTask = (text: string) => {
  const document = parseYahlDocument(text);

  return {
    resultContextKey: document.resultContextKey,
    runInputContextKeys: document.runInput,
    stages: buildStagesFromDocument(document, text),
  };
};

export const parseYahlFile = (text: string): TParsedStage[] =>
  buildStagesFromDocument(parseYahlDocument(text), text);
