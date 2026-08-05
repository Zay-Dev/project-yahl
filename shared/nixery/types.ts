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

export type TNixeryDef = {
  description?: string;
  dockerfile?: string;
  env?: Record<string, string>;
  id: string;
  input?: Record<string, TNixeryInputField>;
  mount?: Record<string, TNixeryMountSpec>;
  nixery?: TNixeryDefBlock;
  output?: TNixeryOutputSpec;
  packages: string[];
  run?: {
    entry: string[];
  };
};
