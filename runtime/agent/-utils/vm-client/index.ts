import type { TStorage } from "@/shared/transports/-types";

import ivm from 'isolated-vm';

type TStorageVm = TStorage & {
  stage?: TStorage['context'];
};

const _createVm = async (
  externalContext: TStorageVm,
  vmOptions: ivm.IsolateOptions = { memoryLimit: 8 },
) => {
  const isolated = new ivm.Isolate(vmOptions);
  const context = await isolated.createContext();

  const jail = context.global;
  
  await jail.set(
    'context',
    new ivm.ExternalCopy({
      context: Object.fromEntries(externalContext.context.entries()),
      types: Object.fromEntries(externalContext.types.entries()),
      stage: Object.fromEntries(externalContext.stage?.entries() || []),
    }).copyInto(),
  );

  return { isolated, context };
};

export const runScript = async (
  script: string,
  _context: TStorageVm,
  vmOptions?: ivm.IsolateOptions,
) => {
  const { isolated, context } = await _createVm(_context, vmOptions);

  const compiled = await isolated.compileScript(script);
  const result = await compiled.run(context, { timeout: 1000 }) as unknown;

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
  _context: TStorage,
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
      types: new Map<string, unknown>(),
      context: new Map(_context?.context || []),

      stage: new Map<string, unknown>(
        [
          ['conditions', stages.map(({ condition }) => condition)]
        ]
      ),
    },
  );

  if (typeof result != 'number') {
    return '';
  }

  return stages[result].script;
};