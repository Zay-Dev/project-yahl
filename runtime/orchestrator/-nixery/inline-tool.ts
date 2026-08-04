import fs from 'node:fs/promises';
import path from 'node:path';

import {
  resolveNixeryInlineToolResult,
  resolveNixeryOutputHint,
} from '@project-yahl/shared/nixery/output-contract';
import { loadDefValidationModule } from '@project-yahl/shared/nixery/load-validation';
import {
  assertNamespaceWriteAllowed,
  isKnowledgeManagerTask,
  isKnowledgeWriteDef,
} from '@project-yahl/shared/nixery/knowledge-write-gate';

import { fetchSession } from '@/orchestrator/-ask-user/session-api';

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

const resolveTaskIdForSession = async (sessionId: string, taskId?: string) => {
  if (taskId?.trim()) {
    return taskId.trim();
  }

  if (!sessionId.trim()) {
    return '';
  }

  try {
    const session = await fetchSession(sessionId);

    return session.taskId?.trim() ?? '';
  } catch {
    return '';
  }
};

export const runNixeryInlineTool = async (params: {
  args: Record<string, unknown>;
  defId: string;
  requestId?: string;
  sessionId: string;
  taskId?: string;
}) => {
  const defId = params.defId.trim();
  const def = await loadNixeryDef(defId);
  const taskId = await resolveTaskIdForSession(params.sessionId, params.taskId);
  const managerWriteBypass = isKnowledgeWriteDef(defId) && isKnowledgeManagerTask(taskId);

  if (!def.output?.inlineTool && !managerWriteBypass) {
    throw new Error(`[nixery] def ${defId} is not enabled for inline tool calls`);
  }

  try {
    assertNamespaceWriteAllowed({ defId, taskId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'knowledge_write_forbidden';

    return { ok: false as const, error: message };
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

  await runNixeryDef({
    defId,
    input,
    sessionId: params.sessionId,
    taskId,
  });

  const outputPath = path.join(resolveSessionNixeryDir(params.sessionId, defId), output);
  const raw = await fs.readFile(outputPath, 'utf8');
  const parsed = await parseInlineToolPayload({ defId, outputPath, raw });

  return resolveNixeryInlineToolResult(parsed);
};
