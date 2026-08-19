import fs from 'node:fs/promises';
import path from 'node:path';

import { runSingleLlmCompletion } from './llm-completion.mjs';

const APPLY_PLAN_PROMPT_PATH = path.join(
  '/opt/nixery/def',
  'prompt.template.md',
);

const loadApplyPlanSystemPrompt = async () => {
  try {
    const raw = await fs.readFile(APPLY_PLAN_PROMPT_PATH, 'utf8');
    const trimmed = raw.trim();

    if (trimmed) {
      return trimmed;
    }
  } catch {
    // fall through
  }

  return [
    'You are the Knowledge Manager ApplyPlan emitter.',
    'Return ONLY one JSON object: { "topic": "<slug>", "ops": [ ... ] }.',
    'ops.op is one of: merge|replace_section|append_raw|discard|todo|transfer.',
    'Prefer targetTopic re-home over transfer; transfer is human-approved only.',
  ].join(' ');
};

export const buildApplyPlanMessages = async (params) => {
  const observationBrief = params.observations.map((row) => ({
    claim: row.claim,
    confidence: row.confidence,
    cue: row.cue,
    example: row.example,
    id: row.id,
    quote: row.quote,
    tags: row.tags ?? [],
  }));

  return [
    {
      role: 'system',
      content: await loadApplyPlanSystemPrompt(),
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

export const completeApplyPlanWithLlm = async (params) => {
  const content = await runSingleLlmCompletion({
    defId: params.defId,
    messages: await buildApplyPlanMessages(params),
  });
  const parsed = extractJsonObject(content);

  if (!parsed) {
    throw new Error('ApplyPlan LLM returned non-JSON');
  }

  return parsed;
};
