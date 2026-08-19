import type { TYahlStage, TParsedStage, TStageLoopMeta } from './types';

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
  const logic = stage.logic;

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

export const compileStage = (
  stage: TYahlStage,
  sourceStartLine: number,
): TParsedStage => ({
  lines: compileStageLines(stage),
  sourceStartLine,
  spec: stage,
  type: stage.whileSetup ? 'while' : stage.loopSetup ? 'loop' : 'plain',
  ...(stage.temperature === undefined ? {} : { temperature: stage.temperature }),
  ...(stage.contextKeys?.length ? { contextKeys: stage.contextKeys } : {}),
  ...(stage.updateContextKeys?.length ? { updateContextKeys: stage.updateContextKeys } : {}),
  ...(stage.produceContextKeys?.length ? { produceContextKeys: stage.produceContextKeys } : {}),
  ...(stage.produceTypeKeys?.length ? { produceTypeKeys: stage.produceTypeKeys } : {}),
});

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
