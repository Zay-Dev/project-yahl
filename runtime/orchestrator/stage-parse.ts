import { createHash } from "crypto";

import type { ParsedStage, StageLoopMeta } from "./orchestrator-types";
import type { RuntimeContext } from "./runtime";

export { getStagesBaseLineInFile } from "./yahl-parse";

const isTraceableYahlLine = (line: string) => {
  const trimmed = line.trim();

  if (!trimmed) return false;
  if (trimmed === "{") return false;
  if (trimmed === "}") return false;

  return true;
};

export const firstTraceableLineOffset = (text: string) => {
  const index = text.split("\n").findIndex((line) => isTraceableYahlLine(line));

  return Math.max(0, index);
};

export const getLineSinceOffset = (text: string, offset: number) =>
  text.split("\n").slice(offset).join("\n") || "";

const leadingTemperaturePattern = /^\s*@temperature\s*\(\s*([0-9]+(?:\.[0-9]+)?)\s*\)\s*/;

export const stripLeadingTemperature = (block: string): { temperature?: number; text: string } => {
  const lines = block.split("\n");
  if (!lines.length) return { text: block };

  const firstLine = lines[0] ?? "";
  const hasContext = !!firstLine.match(/\s*CONTEXT:/);
  const matchTemp = firstLine.match(leadingTemperaturePattern);

  if (!matchTemp) {
    return { text: block };
  }

  const strippedFirst = firstLine.replace(leadingTemperaturePattern, "");
  const text = [strippedFirst, ...lines.slice(1)].join("\n");

  if (hasContext) {
    return { text };
  }

  const temperature = Number(matchTemp[1]);

  if (!Number.isFinite(temperature)) {
    return { text };
  }

  return { temperature, text };
};

type TTemperatureOverrides = {
  loopMeta?: Pick<StageLoopMeta, 'temperature'>;
  temperature?: number;
};

export const resolveEffectiveStageTemperature = (
  stage: ParsedStage,
  overrides?: TTemperatureOverrides,
  lines = stage.lines,
) => {
  const { temperature: decoratorTemp } = stripLeadingTemperature(lines);

  return overrides?.temperature
    ?? stage.spec.temperature
    ?? decoratorTemp
    ?? stage.temperature
    ?? overrides?.loopMeta?.temperature;
};

export const toStableHash = (value: string) =>
  createHash("sha256")
    .update(value, "utf-8")
    .digest("hex")
    .slice(0, 16);

export const parseLoop = (line: string, context: RuntimeContext) => {
  const matchMeta = line.match(/^\s*for each (\w+) of (\[.*\])/i);

  if (!matchMeta) {
    return null;
  }

  const indexName = matchMeta[1];
  const arrayName = matchMeta[2];

  const loopSetup = (() => {
    const matchRange = arrayName.match(/\[(\d+)\.\.(\d+)(,[+-]?(\d+))?\]/);

    if (matchRange) {
      const startAt = parseInt(matchRange[1]);
      const endAfter = parseInt(matchRange[2]);

      const step = matchRange[3] ? parseInt(matchRange[3].slice(1)) :
        (startAt > endAfter ? -1 : 1);

      const array: number[] = [];
      let cursor = startAt;

      while (step >= 0 ? cursor <= endAfter : cursor >= endAfter) {
        array.push(cursor);
        cursor += step;
      }

      return {
        array,
        step: 1,
        startAt: 0,
        endAfter: array.length - 1,
      };
    }

    const matchArray = arrayName.match(/\[(\w+)(,[+-]?(\d+))?\]/);

    if (matchArray) {
      const arrayNameInner = matchArray[1];
      const stageArray = context.get("stage")?.[arrayNameInner];
      const contextArray = context.get("context")?.[arrayNameInner];

      const array = stageArray && Array.isArray(stageArray) ? stageArray : contextArray;
      if (!array || !Array.isArray(array)) return null;

      const step = matchArray[2] ? parseInt(matchArray[2].slice(1)) : 1;

      const startAt = step >= 0 ? 0 : array.length - 1;
      const endAfter = step >= 0 ? array.length - 1 : 0;

      return { startAt, endAfter, step, array };
    }

    return null;
  })();

  if (!loopSetup) return null;

  const { startAt, endAfter, step } = loopSetup;

  if (startAt > endAfter && step > 0) {
    throw new Error(`Invalid range: ${startAt}..${endAfter}, step ${step}`);
  } else if (endAfter > startAt && step < 0) {
    throw new Error(`Invalid range: ${startAt}..${endAfter}, step ${step}`);
  }

  return { indexName, ...loopSetup };
};
