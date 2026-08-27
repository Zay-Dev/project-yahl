import type {
  TNixeryStageInput,
  TYahlAgentOverrides,
  TYahlAskUserEntry,
  TYahlAskUserOption,
  TYahlFragment,
  TYahlGotoEntry,
  TYahlLogic,
  TYahlLogicRef,
  TYahlStage,
  TYahlStagehandConfig,
  TYahlWhileSetup,
} from '@project-yahl/shared/yahl/types';
import {
  NESTED_LOGIC_PLACEHOLDER,
  isNestedLogic,
} from '@project-yahl/shared/yahl/logic';
import { validateYahlStage } from '@project-yahl/shared/yahl/validate-stage';

export type {
  TYahlVerifySpec,
} from '@project-yahl/shared/yahl/verify';
export { DEFAULT_VERIFY_DEF_ID } from '@project-yahl/shared/yahl/verify';

export type YahlAskUserOption = TYahlAskUserOption;
export type YahlAskUserEntry = TYahlAskUserEntry;
export type { TNixeryStageInput };
export type YahlAgentOverrides = TYahlAgentOverrides;
export type YahlStagehandConfig = TYahlStagehandConfig;
export type YahlGotoEntry = TYahlGotoEntry;
export type { TYahlWhileSetup, TYahlLogic, TYahlLogicRef, TYahlFragment };

export type YahlStage = TYahlStage;

export { validateYahlStage };

export const toAgentStage = (stage: YahlStage): YahlStage => {
  const {
    loopSetup: _loopSetup,
    prefixOverride: _prefixOverride,
    verify: _verify,
    warmUp: _warmUp,
    whileSetup: _whileSetup,
    ...rest
  } = stage;

  const logic = isNestedLogic(rest.logic) ? NESTED_LOGIC_PLACEHOLDER : rest.logic;

  return validateYahlStage({
    ...rest,
    logic,
  });
};
