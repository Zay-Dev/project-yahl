import fs from 'node:fs/promises';
import path from 'node:path';

import {
  runKnowledgeManager,
  validateApplyPlan,
} from '/opt/nixery/knowledge-wiki/index.js';
import { runSingleLlmCompletion } from '../_shared/llm-completion.mjs';
import { logProgress, resolveDefId } from '../_shared/run-agent.mjs';

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

const parseTopics = (input) => {
  if (Array.isArray(input.topics)) {
    return input.topics.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
  }

  if (typeof input.topics === 'string' && input.topics.trim()) {
    try {
      const parsed = JSON.parse(input.topics);

      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
      }
    } catch {
      return input.topics.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }

  if (typeof input.topic === 'string' && input.topic.trim()) {
    return [input.topic.trim()];
  }

  return undefined;
};

const extractJsonObject = (text) => {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');

    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
};

const buildApplyPlanMessages = (params) => {
  const observationBrief = params.observations.map((row) => ({
    claim: row.claim,
    confidence: row.confidence,
    cue: row.cue,
    example: row.example,
    id: row.id,
    quote: row.quote,
  }));

  return [
    {
      role: 'system',
      content: [
        'You are the Knowledge Manager ApplyPlan emitter.',
        'Return ONLY one JSON object: { "topic": "<slug>", "ops": [ ... ] }.',
        'No tool calls. No markdown prose outside JSON.',
        'ops.op is one of: merge|replace_section|append_raw|discard|todo|transfer.',
        'Same-topic only for merge/replace_section/todo/append_raw/discard.',
        'transfer requires targetTopic, claim, rationale — never write the target here.',
        'Prefer merge with section + content that includes a worked example.',
        'inferred confidence → todo. Empty/noise → discard.',
        'Respect the global instruction Do/Don\'t/Focus for depth and caution.',
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify({
        depth: params.depth,
        instruction: params.instruction.slice(0, 4000),
        observations: observationBrief,
        topic: params.topic,
      }),
    },
  ];
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
  const dryRun = parseBool(input.dryRun) === true;
  const skipLlmPlan = parseBool(input.skipLlmPlan) === true;
  const topics = parseTopics(input);
  const sessionId = typeof input.sessionId === 'string' ? input.sessionId : undefined;

  if (!process.env.SESSION_API_BASE_URL?.trim()) {
    process.env.SESSION_API_BASE_URL = 'http://server:4000';
  }

  if (!process.env.MASTERMIND_API_URL?.trim()) {
    process.env.MASTERMIND_API_URL = 'http://mastermind:4100';
  }

  logProgress(defId, `start topics=${topics?.join(',') || '*'} dryRun=${dryRun} skipLlm=${skipLlmPlan}`);

  try {
    const completeApplyPlan = skipLlmPlan
      ? undefined
      : async (params) => {
        const content = await runSingleLlmCompletion({
          defId,
          messages: buildApplyPlanMessages(params),
        });
        const parsed = extractJsonObject(content);

        if (!parsed) {
          throw new Error('ApplyPlan LLM returned non-JSON');
        }

        const validated = validateApplyPlan(parsed, params.topic);

        if (!validated.ok) {
          throw new Error(validated.error);
        }

        return validated.plan;
      };

    const report = await runKnowledgeManager({
      completeApplyPlan,
      dryRun,
      sessionId,
      topics,
    });

    const gate = { ok: true, report };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    logProgress(defId, `done ok=true topicCount=${report.topicCount} transfers=${report.approvedTransfersApplied}`);
  } catch (error) {
    const gate = {
      ok: false,
      error: error instanceof Error ? error.message : 'run-knowledge-manager failed',
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
