import type { TNixeryDefBlock, TNixeryPolicyMode } from './types';

export type TResolveNixeryPolicyInput = {
  argv?: string[];
  def: TNixeryDefBlock | undefined;
  tools: string[];
};

const normalizeMode = (mode: TNixeryPolicyMode | undefined): TNixeryPolicyMode =>
  mode ?? 'deny';

const argvMatchesPrefix = (argv: string[], prefix: string[] | undefined) => {
  if (!prefix?.length) {
    return true;
  }

  return prefix.every((token, index) => argv[index + 1] === token);
};

const toolsSubset = (requested: string[], allowed: string[]) =>
  requested.every((tool) => allowed.includes(tool));

export const resolveNixeryPolicy = (input: TResolveNixeryPolicyInput): TNixeryPolicyMode => {
  const { argv = [], def, tools } = input;

  if (!def) {
    return 'deny';
  }

  const stageTools = def.tools ?? [];

  if (stageTools.length > 0 && !toolsSubset(tools, stageTools)) {
    return 'deny';
  }

  const policies = def.policies ?? [];

  for (const policy of policies) {
    if (!toolsSubset(tools, policy.tools)) {
      continue;
    }

    if (!argvMatchesPrefix(argv, policy.argvPrefix)) {
      continue;
    }

    return normalizeMode(policy.mode);
  }

  return normalizeMode(def.default);
};

export const isNixeryPolicyAllowed = (
  policy: TNixeryPolicyMode,
  options?: { autoApproveTrue?: boolean },
) => {
  if (policy === 'deny') {
    return false;
  }

  if (policy === 'true') {
    return options?.autoApproveTrue !== false;
  }

  return false;
};
