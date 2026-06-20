import fs from 'fs/promises';
import path from 'path';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TStorage } from '@/shared/transports/-types';

import { callMastermindSkill } from '@/shared/mastermind-client';

import {
  planAgentPath,
  planBacklogFilePath,
  planFilePath,
} from '@/orchestrator/-utils/workspace-paths';

const PLAN_LOGIC_PREVIEW = 2_000;

const PLAN_HEADING = '# Plan';

const looksLikePlanDocument = (text: string) =>
  text.includes(PLAN_HEADING) || /^##\s+(Goal|Steps|Success criteria)/m.test(text);

const extractPlanText = (response: Awaited<ReturnType<typeof callMastermindSkill>>): string => {
  if (!response.ok) {
    return `# Plan (generation failed)\n\n${response.error ?? 'unknown error'}`;
  }

  const data = response.data;
  let text = '';

  if (typeof data === 'string' && data.trim()) {
    text = data.trim();
  } else if (data && typeof data === 'object' && 'result' in data) {
    const result = (data as { result?: unknown }).result;

    if (typeof result === 'string' && result.trim()) {
      text = result.trim();
    }
  }

  if (!text) {
    return `# Plan (generation failed)\n\nempty mastermind response`;
  }

  if (!looksLikePlanDocument(text)) {
    return [
      '# Plan (generation failed)',
      '',
      'Mastermind returned a status message instead of a plan document.',
      '',
      '## Raw response',
      text,
    ].join('\n');
  }

  return text.startsWith(PLAN_HEADING) ? text : `${PLAN_HEADING}\n\n${text}`;
};

export const prepareStagePlan = async (params: {
  requestId: string;
  sessionId: string;
  stage: ParsedStage;
  storage: TStorage;
}): Promise<string | undefined> => {
  if (params.stage.spec.planMode !== true) {
    return undefined;
  }

  const contextSnapshot = Object.fromEntries(params.storage.context.entries());
  const logicPreview = params.stage.lines.trim().slice(0, PLAN_LOGIC_PREVIEW);

  console.log(
    `[orchestrator] planMode start requestId=${params.requestId} sessionId=${params.sessionId}`,
  );

  const response = await callMastermindSkill('plan', {
    context: contextSnapshot,
    goal: logicPreview,
    stageLogic: logicPreview,
  }, params.sessionId);

  const planBody = extractPlanText(response);
  const absolute = planFilePath(params.requestId);

  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, planBody, 'utf8');

  console.log(
    `[orchestrator] planMode wrote ${absolute} ok=${response.ok} chars=${planBody.length}`,
  );

  return [
    `Follow the execution plan at ${planAgentPath(params.requestId)} when executing this stage logic.`,
    'Do not skip plan steps; persist outputs with set_context as needed.',
  ].join('\n');
};

export const archiveStagePlan = async (requestId: string) => {
  const source = planFilePath(requestId);
  const target = planBacklogFilePath(requestId);

  try {
    await fs.access(source);
  } catch {
    return;
  }

  await fs.mkdir(path.dirname(target), { recursive: true });

  try {
    await fs.rename(source, target);
  } catch {
    const stamp = Date.now();
    await fs.rename(source, planBacklogFilePath(`${requestId}-${stamp}`));
  }
};
