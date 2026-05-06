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

export const runConditionScript = async (
  script: string,
  _context: StageContextPayload,
) => {
  const prefixes = ["IF:", "ELSE IF:", "ELSE:", "END:"]
    .map(prefix => new RegExp(`^\\s*${prefix}`));
  
  const stages = new Array<{
    condition: string;
    script: string;
  }>();
  
  for (const line of script.split("\n")) {
    if (prefixes.some(prefix => prefix.test(line))) {
      stages.push({
        condition: line.substring(line.indexOf(':') + 1).trim(),
        script: '',
      });
    } else if (stages.length > 0) {
      stages.at(-1)!.script += line + "\n";
    }
  }
  
  const { result } = await runScript(
    `
    this.result = undefined;

    for (const [i, condition] of this.stage.conditions.entries()) {
      if (eval(condition || '1 == 1')) {
        this.result = i;
        break;
      }
    }
    `,
    {
      context: {
        ..._context?.context,
      },
      stage: {
        conditions: stages.map(({ condition }) => condition),
      },
      types: {},
    },
  );
  
  if (typeof result != 'number') {
    return '';
  }

  return stages[result].script;
};