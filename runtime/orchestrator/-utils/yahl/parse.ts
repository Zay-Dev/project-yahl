import YAML from "yaml";

import type { YahlStage } from "@/shared/yahl-stage";

import {
  compileForkRunStage as compileForkRunStageShared,
  compileStage as compileStageShared,
  compileStageLines as compileStageLinesShared,
} from "@project-yahl/shared/yahl/stage-compile";
import {
  parseYahlDocument as parseYahlDocumentShared,
  parseYahlFile as parseYahlFileShared,
  parseYahlTask as parseYahlTaskShared,
  type TParseYahlTaskOptions,
} from "@project-yahl/shared/yahl/parse-task";
import { asLogicScript, isNestedLogic, NESTED_LOGIC_PLACEHOLDER } from "@project-yahl/shared/yahl/logic";

import type { ParsedStage, StageLoopMeta } from "./types";
import type { YahlDocument } from "./schema";
import { validateYahlDocument } from "./schema";

export const compileStageLines = (stage: YahlStage): string =>
  compileStageLinesShared(stage);

export const toLoopIterationStage = (
  parent: ParsedStage,
  bodyLines: string,
): ParsedStage => ({
  ...parent,
  lines: bodyLines,
  nestedStages: undefined,
  spec: parent.spec,
  type: "plain",
});

export const loopBodyLinesFromCompiledStage = (lines: string) => {
  const firstLine = lines.split('\n')[0] ?? '';
  const mode = firstLine.match(/\s+[A-Z_]+:\s*{/)?.[0]?.replace('{', '') || '';
  const braceIndex = lines.indexOf('{');

  if (braceIndex < 0) {
    return lines;
  }

  const body = lines.substring(braceIndex);

  return mode ? `${mode} ${body}` : body;
};

export const compileForkRunStage = (
  stage: YahlStage,
  loopMeta?: StageLoopMeta,
  sourceStartLine = 1,
): ParsedStage =>
  compileForkRunStageShared(stage, loopMeta, sourceStartLine) as ParsedStage;

export const compileStage = (
  stage: YahlStage,
  sourceStartLine: number,
  options?: TParseYahlTaskOptions,
): ParsedStage =>
  compileStageShared(
    stage,
    sourceStartLine,
    options?.taskRoot
      ? {
        readFile: options.readFile,
        taskRoot: options.taskRoot,
      }
      : undefined,
  ) as ParsedStage;

export const parseYahlDocument = (text: string): YahlDocument => {
  try {
    return parseYahlDocumentShared(text) as YahlDocument;
  } catch {
    const parsed = YAML.parse(text);

    return validateYahlDocument(parsed);
  }
};

export const parseYahlFile = (
  text: string,
  options?: TParseYahlTaskOptions,
): ParsedStage[] =>
  parseYahlFileShared(text, options) as ParsedStage[];

export const parseYahlTask = (
  text: string,
  options?: TParseYahlTaskOptions,
) => parseYahlTaskShared(text, options);

export const getStagesBaseLineInFile = (text: string) => {
  const lines = text.split(/\r?\n/);
  const stagesIndex = lines.findIndex((line) => /^\s*stages:\s*$/.test(line));

  if (stagesIndex >= 0) {
    return stagesIndex + 2;
  }

  const logicIndex = lines.findIndex((line) => /^\s*logic:\s*/.test(line));

  return logicIndex >= 0 ? logicIndex + 1 : 1;
};

export const isYahlDocument = (text: string) => {
  try {
    const parsed = YAML.parse(text);

    return Boolean(
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as Record<string, unknown>).name === "string" &&
      Array.isArray((parsed as Record<string, unknown>).stages),
    );
  } catch {
    return false;
  }
};

export const stageLogicScript = (stage: YahlStage): string => {
  if (isNestedLogic(stage.logic)) {
    return NESTED_LOGIC_PLACEHOLDER;
  }

  return asLogicScript(stage.logic);
};
