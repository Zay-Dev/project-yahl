import type { ParsedStage, StageLoopMeta } from "./orchestrator-types";

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
