import fs from 'node:fs/promises';
import path from 'node:path';

import {
  applyManagerTopic,
  listPendingObservations,
  shouldUseHeuristicApplyPlan,
  validateApplyPlan,
} from '/opt/nixery/plugin/lib/dist/index.js';
import { completeApplyPlanWithLlm } from '../lib/knowledge-manager-llm.mjs';
import { logProgress, resolveDefId } from '../lib/run-agent.mjs';

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const parseBool = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();

  if (trimmed === 'true' || trimmed === '1') {
    return true;
  }

  if (trimmed === 'false' || trimmed === '0') {
    return false;
  }

  return undefined;
};

const main = async () => {
  const workspace = '/workspace';
  const defRoot = '/opt/nixery/def';
  const defId = resolveDefId(defRoot);
  const input = await readJson(path.join(workspace, 'input.json'));
  const outputName = typeof input.output === 'string' && input.output.trim()
    ? input.output.trim()
    : 'result.json';
  const outputPath = path.join(workspace, outputName);
  const topic = typeof input.topic === 'string' ? input.topic.trim() : '';
  const instruction = typeof input.instruction === 'string' ? input.instruction : '';
  const dryRun = parseBool(input.dryRun) === true;
  const skipLlmPlan = parseBool(input.skipLlmPlan) === true;
  const sessionId = typeof input.sessionId === 'string' ? input.sessionId : undefined;

  if (!topic) {
    const gate = { ok: false, error: 'topic is required' };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    process.exit(1);
  }

  if (!process.env.SESSION_API_BASE_URL?.trim()) {
    process.env.SESSION_API_BASE_URL = 'http://server:4000';
  }

  try {
    const pending = await listPendingObservations(topic);
    const forceHeuristic = skipLlmPlan || shouldUseHeuristicApplyPlan(pending);

    logProgress(
      defId,
      `start topic=${topic} dryRun=${dryRun} skipLlm=${forceHeuristic} pending=${pending.length}`,
    );

    const completeApplyPlan = forceHeuristic
      ? undefined
      : async (params) => {
        const parsed = await completeApplyPlanWithLlm({
          ...params,
          defId,
        });
        const validated = validateApplyPlan(parsed, params.topic);

        if (!validated.ok) {
          throw new Error(validated.error);
        }

        return validated.plan;
      };

    const review = await applyManagerTopic({
      completeApplyPlan,
      dryRun,
      instruction,
      sessionId,
      topic,
    });

    const gate = { ok: true, review };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    logProgress(defId, `done ok=true topic=${topic} ops=${review.opsApplied} consumed=${review.consumed}`);
  } catch (error) {
    const gate = {
      ok: false,
      error: error instanceof Error ? error.message : 'apply-manager-topic failed',
    };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    logProgress(defId, `done ok=false error=${gate.error}`);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
