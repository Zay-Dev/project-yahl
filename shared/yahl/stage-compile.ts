import type { TYahlStage, TParsedStage, TStageLoopMeta, TYahlFragment } from './types';
import {
  NESTED_LOGIC_PLACEHOLDER,
  asLogicScript,
  isNestedLogic,
  isYahlFragment,
} from './logic';
import { resolveLogicToFragment, type TResolveYahlRefOptions } from './resolve-yahl-ref';

const logicNeedsBraceWrap = (logic: string) => {
  const trimmed = logic.trim();

  return !trimmed.startsWith('{') && !trimmed.startsWith('IF:');
};

const wrapPlainLogic = (logic: string) => {
  if (!logicNeedsBraceWrap(logic)) {
    return logic;
  }

  return `{\n${logic}\n}`;
};

export const compileStageLines = (stage: TYahlStage): string => {
  if (isNestedLogic(stage.logic)) {
    return NESTED_LOGIC_PLACEHOLDER;
  }

  const logic = asLogicScript(stage.logic);

  if (stage.conditionMode) {
    return logic;
  }

  if (stage.loopSetup) {
    if (stage.contextMode) {
      const body = logic.startsWith('{') ? logic : `{\n${logic}\n}`;

      return `${stage.loopSetup} CONTEXT: ${body}`;
    }

    return `${stage.loopSetup} ${wrapPlainLogic(logic)}`;
  }

  if (stage.contextMode) {
    const body = logic.startsWith('{') ? logic : `{\n${logic}\n}`;

    return `CONTEXT: ${body}`;
  }

  return wrapPlainLogic(logic);
};

const loopBodyLinesFromCompiledStage = (lines: string) => {
  const firstLine = lines.split('\n')[0] ?? '';
  const mode = firstLine.match(/\s+[A-Z_]+:\s*{/)?.[0]?.replace('{', '') || '';
  const braceIndex = lines.indexOf('{');

  if (braceIndex < 0) {
    return lines;
  }

  const body = lines.substring(braceIndex);

  return mode ? `${mode} ${body}` : body;
};

const compileNestedStages = (
  fragment: TYahlFragment,
  sourceStartLine: number,
): TParsedStage[] => {
  const nested: TParsedStage[] = [];

  if (fragment.types) {
    nested.push(compileStage({ logic: fragment.types }, sourceStartLine));
  }

  fragment.stages.forEach((child) => {
    nested.push(compileStage(child, sourceStartLine));
  });

  return nested;
};

export const compileStage = (
  stage: TYahlStage,
  sourceStartLine: number,
  resolveOptions?: TResolveYahlRefOptions,
): TParsedStage => {
  let nestedStages: TParsedStage[] | undefined;

  if (isNestedLogic(stage.logic)) {
    const fragment = isYahlFragment(stage.logic)
      ? stage.logic
      : resolveOptions
        ? resolveLogicToFragment(stage.logic, resolveOptions)
        : undefined;

    if (!fragment) {
      throw new Error(
        `stage at line ${sourceStartLine}: $ref logic requires taskRoot to resolve`,
      );
    }

    nestedStages = compileNestedStages(fragment, sourceStartLine);
  }

  return {
    lines: compileStageLines(stage),
    sourceStartLine,
    spec: stage,
    type: stage.whileSetup ? 'while' : stage.loopSetup ? 'loop' : 'plain',
    ...(nestedStages ? { nestedStages } : {}),
    ...(stage.temperature === undefined ? {} : { temperature: stage.temperature }),
    ...(stage.contextKeys?.length ? { contextKeys: stage.contextKeys } : {}),
    ...(stage.updateContextKeys?.length ? { updateContextKeys: stage.updateContextKeys } : {}),
    ...(stage.produceContextKeys?.length ? { produceContextKeys: stage.produceContextKeys } : {}),
    ...(stage.produceTypeKeys?.length ? { produceTypeKeys: stage.produceTypeKeys } : {}),
  };
};

export const compileForkRunStage = (
  stage: TYahlStage,
  loopMeta?: TStageLoopMeta,
  sourceStartLine = 1,
): TParsedStage => {
  const parsed = compileStage(stage, sourceStartLine);

  if (!loopMeta) {
    return parsed;
  }

  return {
    ...parsed,
    lines: loopBodyLinesFromCompiledStage(parsed.lines),
    type: 'plain',
  };
};
