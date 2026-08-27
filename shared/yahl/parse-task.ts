import YAML from 'yaml';

import type { TParsedStage } from './types';
import type { TYahlDocument } from './document-schema';
import { validateYahlDocument } from './document-schema';
import { compileStage } from './stage-compile';
import type { TYahlStage } from './types';
import type { TResolveYahlRefOptions } from './resolve-yahl-ref';

export type TParseYahlTaskOptions = {
  readFile?: (absolutePath: string) => string;
  taskRoot?: string;
};

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

const buildStagesFromDocument = (
  document: TYahlDocument,
  text: string,
  resolveOptions?: TResolveYahlRefOptions,
): TParsedStage[] => {
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
    stages.push(compileStage(stage, findLogicSourceLine(text, index), resolveOptions));
  });

  return stages;
};

export const parseYahlDocument = (text: string): TYahlDocument => {
  const parsed = YAML.parse(text);

  return validateYahlDocument(parsed);
};

export const parseYahlTask = (text: string, options: TParseYahlTaskOptions = {}) => {
  const document = parseYahlDocument(text);
  const yahlRefs: Record<string, string> = {};
  const resolveOptions = options.taskRoot
    ? {
      readFile: options.readFile,
      refsOut: yahlRefs,
      taskRoot: options.taskRoot,
    } satisfies TResolveYahlRefOptions
    : undefined;

  return {
    resultContextKey: document.resultContextKey,
    runInputContextKeys: document.runInput?.map((field) => field.key),
    stages: buildStagesFromDocument(document, text, resolveOptions),
    ...(Object.keys(yahlRefs).length ? { yahlRefs } : {}),
  };
};

export const parseYahlFile = (
  text: string,
  options: TParseYahlTaskOptions = {},
): TParsedStage[] =>
  parseYahlTask(text, options).stages;
