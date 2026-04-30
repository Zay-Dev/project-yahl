import type { StageContextPayload } from "@/shared/stage-contract";

import * as vm from 'node:vm';

const _tools = {
  setTimeout,
};

export const runScript = async (
  script: string,
  _context: StageContextPayload,
) => {
  const context = {
    ...JSON.parse(JSON.stringify(_context)),
    _tools,
  };

  vm.createContext(context);
  await new vm.Script(script).runInContext(context);

  delete context._tools;
  delete context.context;
  delete context.stage;
  delete context.types;
  
  return context as Record<string, unknown>;
};