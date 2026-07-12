import fs from 'node:fs/promises';
import path from 'node:path';

import {
  resolveNixeryInlineToolResult,
  resolveNixeryOutputHint,
} from '@project-yahl/shared/nixery/output-contract';
import { loadDefValidationModule } from '@project-yahl/shared/nixery/load-validation';

import { loadNixeryDef, resolveNixeryRoot } from './load-def';
import { runNixeryDef, resolveSessionNixeryDir } from './run-stage';

import type { TNixeryDef } from '@project-yahl/shared/nixery/types';

export const resolveNixeryToolOutputHint = (
  def: TNixeryDef,
  args: Record<string, unknown>,
) => resolveNixeryOutputHint(def, args);

const parseInlineToolPayload = async (params: {
  defId: string;
  outputPath: string;
  raw: string;
}) => {
  const mod = await loadDefValidationModule(resolveNixeryRoot(), params.defId);

  if (typeof mod.parseOutput === 'function') {
    const parsed = mod.parseOutput(params.raw);

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }

  return JSON.parse(params.raw) as Record<string, unknown>;
};

export const runNixeryInlineTool = async (params: {
  args: Record<string, unknown>;
  defId: string;
  sessionId: string;
}) => {
  const defId = params.defId.trim();
  const def = await loadNixeryDef(defId);

  if (!def.output?.inlineTool) {
    throw new Error(`[nixery] def ${defId} is not enabled for inline tool calls`);
  }

  const output = resolveNixeryOutputHint(def, params.args);
  const input = {
    ...params.args,
    output,
  };

  await runNixeryDef({
    defId,
    input,
    sessionId: params.sessionId,
  });

  const outputPath = path.join(resolveSessionNixeryDir(params.sessionId, defId), output);
  const raw = await fs.readFile(outputPath, 'utf8');
  const parsed = await parseInlineToolPayload({ defId, outputPath, raw });

  return resolveNixeryInlineToolResult(parsed);
};
