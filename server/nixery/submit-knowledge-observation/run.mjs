import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  formatObservationMarkdown,
  observationPagePath,
  runUpsertKnowledgePage,
  validateKnowledgeObservation,
} from '/opt/nixery/knowledge-wiki/index.js';
import { logProgress, resolveDefId } from '../_shared/run-agent.mjs';

import { buildObservationInput } from './build-observation-input.mjs';

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

  const validated = validateKnowledgeObservation(buildObservationInput(input));

  if (!validated.ok) {
    const gate = { ok: false, error: validated.error };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    process.exit(1);
  }

  const observation = validated.observation;
  const id = randomUUID().slice(0, 12);
  const submittedAt = new Date().toISOString();
  const page = observationPagePath({ id });
  const content = formatObservationMarkdown(observation, { id, submittedAt });

  logProgress(defId, `submit topic=${observation.topic_hint} page=${page}`);

  const result = await runUpsertKnowledgePage({
    topic: observation.topic_hint,
    page,
    content,
    mode: 'create',
    title: `Observation ${id}`,
  });

  const pathOut = result.ok
    ? (result.wikiPath ?? result.pagePath ?? result.path ?? '').replace(/^en\//, '')
    : '';

  const gate = result.ok && pathOut
    ? { ok: true, path: pathOut, observationId: id, topic: observation.topic_hint }
    : { ok: false, error: result.error ?? 'observation upsert failed' };

  await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    path.join(workspace, 'observation-detail.json'),
    `${JSON.stringify({ observation, result }, null, 2)}\n`,
    'utf8',
  );

  if (!gate.ok) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
