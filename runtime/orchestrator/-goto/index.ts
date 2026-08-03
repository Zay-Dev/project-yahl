import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TChatToolCall, TStorage } from '@/shared/transports/-types';

import {
  formatStageGotoCommand,
  MAX_SESSION_STAGE_GOTOS,
  parseStageGotoCommand,
  STAGE_GOTO_FROM_KEY,
  STAGE_GOTO_REASON_KEY,
} from '@project-yahl/shared/yahl/stage-goto';

import { parseGotoStageToolArguments } from '@/shared/stage-tools';

export type TGotoStageTransfer = {
  fromLabel: string;
  reason: string;
  stageId: string;
  targetStageIndex: number;
};

export type TGotoStageToolResult = {
  hasError: boolean;
  result: string;
  transfer?: TGotoStageTransfer;
};

export const buildStageIdIndexMap = (stages: ParsedStage[]): Map<string, number> => {
  const map = new Map<string, number>();

  stages.forEach((stage, index) => {
    const id = stage.spec.id?.trim();

    if (!id) {
      return;
    }

    map.set(id, index);
  });

  return map;
};

export const buildGotoSystemAppend = (stage: ParsedStage): string | undefined => {
  const entries = stage.spec.goto;

  if (!entries?.length) {
    return undefined;
  }

  const lines = [
    'Declared stage transfers (goto). Call goto_stage only for these targets:',
    ...entries.map((entry) => `- ${entry.command}: ${entry.description}`),
    'Arguments: { "stageId": "<id>", "reason": "<non-empty>" }. On success this stage ends without verify.',
  ];

  return lines.join('\n');
};

export const clearStageGotoContext = (storage: TStorage) => {
  storage.context.delete(STAGE_GOTO_REASON_KEY);
  storage.context.delete(STAGE_GOTO_FROM_KEY);
};

export const applyStageGotoContext = (
  storage: TStorage,
  transfer: TGotoStageTransfer,
) => {
  storage.context.set(STAGE_GOTO_REASON_KEY, transfer.reason);
  storage.context.set(STAGE_GOTO_FROM_KEY, transfer.fromLabel);
};

export const resolveGotoTargetIndex = (
  stages: ParsedStage[],
  stageId: string,
): number | null => {
  const map = buildStageIdIndexMap(stages);
  const index = map.get(stageId);

  return index === undefined ? null : index;
};

export const handleGotoStageToolCall = (params: {
  currentParsedStageIndex: number;
  gotoCount: number;
  stages: ParsedStage[];
  stage: ParsedStage;
  storage: TStorage;
  toolCall: TChatToolCall;
}): TGotoStageToolResult => {
  if (params.gotoCount >= MAX_SESSION_STAGE_GOTOS) {
    return {
      hasError: true,
      result: `goto_stage: exceeded max transfers (${MAX_SESSION_STAGE_GOTOS})`,
    };
  }

  const args = parseGotoStageToolArguments(params.toolCall.function.arguments ?? '');

  if (!args) {
    return { hasError: true, result: 'goto_stage: invalid arguments' };
  }

  const allowed = params.stage.spec.goto ?? [];
  const command = formatStageGotoCommand(args.stageId);
  const declared = allowed.some((entry) => {
    const targetId = parseStageGotoCommand(entry.command);

    return targetId === args.stageId || entry.command.trim() === command;
  });

  if (!declared) {
    return {
      hasError: true,
      result: `goto_stage: "${args.stageId}" is not in this stage's goto list`,
    };
  }

  const targetStageIndex = resolveGotoTargetIndex(params.stages, args.stageId);

  if (targetStageIndex == null) {
    return {
      hasError: true,
      result: `goto_stage: unknown stage id "${args.stageId}"`,
    };
  }

  if (targetStageIndex === params.currentParsedStageIndex) {
    return {
      hasError: true,
      result: 'goto_stage: cannot jump to the current stage',
    };
  }

  const fromLabel = params.stage.spec.id?.trim()
    || `#${params.currentParsedStageIndex}`;

  const transfer: TGotoStageTransfer = {
    fromLabel,
    reason: args.reason,
    stageId: args.stageId,
    targetStageIndex,
  };

  applyStageGotoContext(params.storage, transfer);

  return {
    hasError: false,
    result: JSON.stringify({
      ok: true,
      stageId: args.stageId,
      transfer: true,
    }),
    transfer,
  };
};

export const isGotoTransferToolResult = (content: string): boolean => {
  try {
    const parsed = JSON.parse(content) as { ok?: unknown; transfer?: unknown };

    return parsed.ok === true && parsed.transfer === true;
  } catch {
    return false;
  }
};
