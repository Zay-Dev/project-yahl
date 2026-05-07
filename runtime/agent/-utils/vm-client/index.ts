import type { StageContextPayload } from "@/shared/stage-contract";

import ivm from 'isolated-vm';

const _createVm = async (
  externalContext: StageContextPayload,
  vmOptions: ivm.IsolateOptions = { memoryLimit: 8 },
) => {
  const isolated = new ivm.Isolate(vmOptions);
  const context = await isolated.createContext();

  const jail = context.global;

  await jail.set(
    'context',
    new ivm.ExternalCopy(externalContext).copyInto(),
  );

  return { isolated, context };
};

export const runScript = async (
  script: string,
  _context: StageContextPayload,
  vmOptions?: ivm.IsolateOptions,
) => {
  const { isolated, context } = await _createVm(_context, vmOptions);

  const compiled = await isolated.compileScript(script);
  const result = await compiled.run(context, { timeout: 10 }) as unknown;

  const objectOrFunction = ['object', 'function'].includes(typeof result);

  if (!result || !objectOrFunction || Array.isArray(result)) {
    isolated.dispose();
    return { result };
  }

  const normalizedResult = typeof result === 'function' ? result() : result;

  isolated.dispose();
  
  return Object.fromEntries(
    Object.entries(normalizedResult)
      .map(([key, value]) => [key, value as unknown])
  );
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
    for (const [i, condition] of context.stage.conditions.entries()) {
      if (eval(condition || '1 == 1')) {
        result = i;
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