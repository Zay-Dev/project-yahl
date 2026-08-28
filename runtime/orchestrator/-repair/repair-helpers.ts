import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

export const REPAIR_MIN_MAX_TURNS = 40;
export const REPAIR_MIN_MAX_BASH_CALLS = 36;

export const buildRepairSystemAppend = (instruction: string) => {
  const trimmed = instruction.trim();

  return [
    'The user requested a targeted repair of this stage.',
    'The repair instruction below is the primary goal. Complete that work first — including durable writes under ~/data/ (scripts and .md instruction/ops files) when the instruction requires them.',
    'Do not spend the turn or bash budget on unrelated stage chrome (browser Search, observe loops, etc.) until the repair instruction is done.',
    'After the repair work is finished, use set_context to write any required context keys so the stage ends coherently.',
    trimmed,
  ].filter(Boolean).join('\n\n');
};

export const applyRepairBudgets = (stage: ParsedStage): ParsedStage => {
  const maxTurns = Math.max(stage.spec.maxTurns ?? 0, REPAIR_MIN_MAX_TURNS);
  const maxBashCalls = Math.max(stage.spec.maxBashCalls ?? 0, REPAIR_MIN_MAX_BASH_CALLS);

  if (
    stage.spec.maxTurns === maxTurns
    && stage.spec.maxBashCalls === maxBashCalls
  ) {
    return stage;
  }

  return {
    ...stage,
    spec: {
      ...stage.spec,
      maxBashCalls,
      maxTurns,
    },
  };
};
