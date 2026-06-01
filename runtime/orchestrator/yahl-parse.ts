import YAML from "yaml";

import type { YahlStage } from "../shared/yahl-stage";

import type { ParsedStage } from "./orchestrator-types";
import type { YahlDocument } from "./yahl-schema";
import { validateYahlDocument } from "./yahl-schema";

const logicNeedsBraceWrap = (logic: string) => {
  const trimmed = logic.trim();

  return !trimmed.startsWith("{") && !trimmed.startsWith("IF:");
};

const wrapPlainLogic = (logic: string) => {
  if (!logicNeedsBraceWrap(logic)) {
    return logic;
  }

  return `{\n${logic}\n}`;
};

export const compileStageLines = (stage: YahlStage): string => {
  const logic = stage.logic;

  if (stage.conditionMode) {
    return logic;
  }

  if (stage.loopSetup) {
    if (stage.contextMode) {
      const body = logic.startsWith("{") ? logic : `{\n${logic}\n}`;

      return `${stage.loopSetup} CONTEXT: ${body}`;
    }

    return `${stage.loopSetup} ${wrapPlainLogic(logic)}`;
  }

  if (stage.contextMode) {
    const body = logic.startsWith("{") ? logic : `{\n${logic}\n}`;

    return `CONTEXT: ${body}`;
  }

  return wrapPlainLogic(logic);
};

export const toLoopIterationStage = (
  parent: ParsedStage,
  bodyLines: string,
): ParsedStage => ({
  ...parent,
  lines: bodyLines,
  spec: parent.spec,
  type: "plain",
});

export const compileStage = (
  stage: YahlStage,
  sourceStartLine: number,
): ParsedStage => ({
  lines: compileStageLines(stage),
  sourceStartLine,
  spec: stage,
  type: stage.loopSetup ? "loop" : "plain",
  ...(stage.temperature === undefined ? {} : { temperature: stage.temperature }),
  ...(stage.contextKeys?.length ? { contextKeys: stage.contextKeys } : {}),
  ...(stage.updateContextKeys?.length ? { updateContextKeys: stage.updateContextKeys } : {}),
  ...(stage.produceContextKeys?.length ? { produceContextKeys: stage.produceContextKeys } : {}),
  ...(stage.produceTypeKeys?.length ? { produceTypeKeys: stage.produceTypeKeys } : {}),
});

const findLogicSourceLine = (fileText: string, stageIndex: number) => {
  const lines = fileText.split(/\r?\n/);
  let seenStages = -1;
  let inStages = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";

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

export const parseYahlDocument = (text: string): YahlDocument => {
  const parsed = YAML.parse(text);

  return validateYahlDocument(parsed);
};

export const parseYahlFile = (text: string): ParsedStage[] => {
  const document = parseYahlDocument(text);
  const stages: ParsedStage[] = [];

  if (document.types) {
    const typesSpec: YahlStage = { logic: document.types };

    stages.push({
      lines: wrapPlainLogic(document.types),
      sourceStartLine: findTypesSourceLine(text),
      spec: typesSpec,
      type: "plain",
    });
  }

  document.stages.forEach((stage, index) => {
    stages.push(compileStage(stage, findLogicSourceLine(text, index)));
  });

  return stages;
};

const findTypesSourceLine = (fileText: string) => {
  const index = fileText.split(/\r?\n/).findIndex((line) => /^\s*types:\s*(?:\||>)?\s*$/.test(line));

  return index >= 0 ? index + 2 : 1;
};

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

export const resolveStagesFromText = (text: string): ParsedStage[] => {
  if (isYahlDocument(text)) {
    return parseYahlFile(text);
  }

  const stripped = text
    .replace(/^```ai\.logic\n/, "")
    .replace(/\n```\s*$/, "")
    .trim();

  if (!stripped) {
    return [];
  }

  const loopHeaderMatch = stripped.match(/^(\s*for each\s+\w+\s+of\s+\[.*?\])\s*/i);
  const isLoop =
    !!loopHeaderMatch &&
    !!["{", "}"].find((char) => stripped.trim().endsWith(char));

  const spec: YahlStage = isLoop && loopHeaderMatch
    ? {
      logic: stripped.slice(loopHeaderMatch[0].length).trim(),
      loopSetup: loopHeaderMatch[1].trim(),
    }
    : { logic: stripped };

  return [{
    lines: stripped,
    sourceStartLine: 1,
    spec,
    type: isLoop ? "loop" : "plain",
  }];
};
