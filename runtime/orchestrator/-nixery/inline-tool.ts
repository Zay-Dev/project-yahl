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

const toInlineError = (error: unknown, defRunCompleted = false) => {
  const message = error instanceof Error ? error.message : String(error);

  return {
    ok: false as const,
    error: message,
    ...(defRunCompleted ? { defRunCompleted: true as const } : {}),
  };
};

export const runNixeryInlineTool = async (params: {
  args: Record<string, unknown>;
  defId: string;
  requestId?: string;
  sessionId: string;
}) => {
  try {
    const defId = params.defId.trim();
    const { def } = await loadNixeryDef(defId);

    if (!def.output?.inlineTool) {
      return toInlineError(new Error(`[nixery] def ${defId} is not enabled for inline tool calls`));
    }

    const output = resolveNixeryOutputHint(def, params.args);
    const input = {
      ...params.args,
      ...(params.sessionId.trim() && !params.args.sessionId
        ? { sessionId: params.sessionId }
        : {}),
      ...(params.requestId?.trim() && !params.args.requestId
        ? { requestId: params.requestId.trim() }
        : {}),
      output,
    };

    try {
      await runNixeryDef({
        defId,
        input,
        sessionId: params.sessionId,
      });
    } catch (error) {
      return toInlineError(error, true);
    }

    const outputPath = path.join(resolveSessionNixeryDir(params.sessionId, defId), output);
    const raw = await fs.readFile(outputPath, 'utf8');
    const parsed = await parseInlineToolPayload({ defId, outputPath, raw });
    const result = resolveNixeryInlineToolResult(parsed);

    return {
      ...result,
      defRunCompleted: true as const,
    };
  } catch (error) {
    return toInlineError(error);
  }
};
