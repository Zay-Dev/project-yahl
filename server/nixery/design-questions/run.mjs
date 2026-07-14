import fs from 'node:fs/promises';
import path from 'node:path';

import { runSingleLlmCompletion } from '../_shared/llm-completion.mjs';
import { logProgress, resolveDefId } from '../_shared/run-agent.mjs';
import { extractJsonFromText, parseJsonValue } from '../_shared/session-fs.mjs';

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
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
  const stage = input.stage ?? input.stageIndex ?? input.stageName ?? '';
  const gaps = parseJsonValue(input.gaps ?? input.need) ?? [];
  const priorQa = parseJsonValue(input.priorQa ?? input.prior_qa) ?? [];
  const mission = typeof input.mission === 'string'
    ? input.mission.trim()
    : typeof input.subjectContext === 'string'
      ? input.subjectContext.trim()
      : '';
  const goal = typeof input.goal === 'string' ? input.goal.trim() : '';

  logProgress(defId, `start stage=${JSON.stringify(stage)}`);

  const content = await runSingleLlmCompletion({
    defId,
    messages: [
      {
        content: [
          'You are the YAHL design-questions helper.',
          'Return JSON only: {"batches":[{"batchId":"...","title":"...","questions":[...]}],"done":boolean}',
          'Each batch must contain only independently answerable questions (unique questionRef per batch).',
          'Prefer multipleChoice over text when 2–6 discrete answers fit; use text only for open-ended gaps.',
          'Question kinds: "text" or "multipleChoice" (radio when allowMultiple false, checkboxes when true).',
          'multipleChoice requires at least 2 options with non-empty id and label.',
          'Do not include allowFreeText — free-text counter-option is built into the UI.',
          'Group independent gaps into one batch; dependent questions go in a later batch (done:false).',
        ].join(' '),
        role: 'system',
      },
      {
        content: [
          mission
            ? `Mission (do NOT ask about the task process — ask about the subject/user goal):\n${mission}`
            : '',
          `Stage: ${JSON.stringify(stage)}`,
          `Gaps: ${JSON.stringify(gaps, null, 2).slice(0, 8_000)}`,
          `Prior Q&A: ${JSON.stringify(priorQa, null, 2).slice(0, 8_000)}`,
          goal ? `Goal: ${goal}` : '',
        ].filter(Boolean).join('\n\n'),
        role: 'user',
      },
    ],
  });

  const parsed = extractJsonFromText(content);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('design-questions returned invalid JSON');
  }

  const gate = {
    batches: parsed.batches,
    done: parsed.done === true,
    ok: true,
  };

  await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');

  logProgress(defId, `done batches=${Array.isArray(gate.batches) ? gate.batches.length : 0}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
