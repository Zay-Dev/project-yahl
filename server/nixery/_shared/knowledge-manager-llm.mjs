import { runSingleLlmCompletion } from './llm-completion.mjs';

export const buildApplyPlanMessages = (params) => {
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
      content: [
        'You are the Knowledge Manager ApplyPlan emitter.',
        'Return ONLY one JSON object: { "topic": "<slug>", "ops": [ ... ] }.',
        'No tool calls. No markdown prose outside JSON.',
        'ops.op is one of: merge|replace_section|append_raw|discard|todo|transfer.',
        'Same-topic only for merge/replace_section/todo/append_raw/discard.',
        'transfer requires targetTopic, claim, rationale — never write the target here.',
        'Route PLACE tags to facts / PLACE section; HOWTO/TRICK/Q&A to matching sections; SUMMARY → append_raw.',
        'Prefer merge with section + content that includes a worked example.',
        'When quoted evidence contradicts an old entity binding, use replace_section or merge a clear counterexample — do not keep both as equal facts.',
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
    messages: buildApplyPlanMessages(params),
  });
  const parsed = extractJsonObject(content);

  if (!parsed) {
    throw new Error('ApplyPlan LLM returned non-JSON');
  }

  return parsed;
};
