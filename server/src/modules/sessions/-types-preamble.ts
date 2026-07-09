import type { TYahlStage } from './-types';

const TYPES_LOGIC_PATTERN = /^\s*(?:export\s+)?type\s+\w+/m;

export const isTypesPreambleStage = (stage: {
  spec: TYahlStage;
  type: 'loop' | 'plain';
}): boolean => {
  if (stage.type === 'loop') {
    return false;
  }

  const { spec } = stage;

  if (
    spec.loopSetup
    || spec.contextMode
    || spec.conditionMode
    || spec.verify
    || spec.produceContextKeys?.length
    || spec.contextKeys?.length
  ) {
    return false;
  }

  return TYPES_LOGIC_PATTERN.test(spec.logic ?? '');
};
