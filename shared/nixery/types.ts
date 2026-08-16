export type TNixeryOutputSpec = {
  default?: string;
  inlineTool?: boolean;
  retry?: number;
  validate?: string;
};

export type TNixeryPolicyMode = 'true' | 'propose' | 'deny';

type TNixeryPolicy = {
  argvPrefix?: string[];
  mode: TNixeryPolicyMode;
  tools: string[];
};

export type TNixeryDefBlock = {
  default?: TNixeryPolicyMode;
  policies?: TNixeryPolicy[];
  tools?: string[];
};

export type TNixeryMountSpec = {
  host: string;
  mode: 'ro' | 'rw';
};

export type TNixeryInputField = {
  required?: boolean;
  type: 'string';
};

export type TNixeryRuntime = 'node' | 'tsx' | 'python';

export type TNixeryDef = {
  description?: string;
  env?: Record<string, string>;
  id: string;
  input?: Record<string, TNixeryInputField>;
  mount?: Record<string, TNixeryMountSpec>;
  nixery?: TNixeryDefBlock;
  output?: TNixeryOutputSpec;
  packages: string[];
  run?: {
    entry: string;
    runtime: TNixeryRuntime;
  };
};

export type TNixeryPluginMeta = {
  description?: string;
  name?: string;
  prompts?: string[];
  skills?: string[];
  task_skills?: string[];
};

export type TNixeryAbilityLocation = {
  abilityId: string;
  abilityDir: string;
  indexPath: string;
  pluginDir: string;
  pluginId: string;
};
