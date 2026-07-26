import fs from 'node:fs/promises';
import path from 'node:path';

import { loadKnowledgeCorpusForNeed } from '/opt/nixery/knowledge-wiki/load-corpus.js';
import { runSingleLlmCompletion } from '../_shared/llm-completion.mjs';
import { logProgress, resolveDefId } from '../_shared/run-agent.mjs';

import { parseKnowledgeQaReviewResponse } from './parse-review.mjs';

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const parseAuditIssues = (value) => {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string');
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === 'string');
      }
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }

  return [];
};

const SYSTEM_PROMPT = [
  'You are a YAHL knowledge wiki QA reviewer.',
  'Review only — do not edit wiki pages, run research, or migrate files.',
  'Score each checklist item; emit actionable todos for knowledge_refresh (not tidy).',
  'Return JSON only matching this shape:',
  '{"topic":"...","checks":[{"id":"...","pass":boolean,"note":"..."}],"todos":[{"id":"...","kind":"expand_questions|plan_study|elaborate_section|research_source","priority":"high|medium|low","summary":"...","detail":"..."}],"summary":"..."}',
].join('\n\n');

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
  const need = typeof input.need === 'string' && input.need.trim()
    ? input.need.trim()
    : 'overview, brief, facts, sources, raw keys';
  const auditIssues = parseAuditIssues(input.auditIssues);

  const writeGate = async (gate) => {
    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
  };

  if (!topic) {
    await writeGate({ ok: false, error: 'topic required' });
    process.exit(1);
  }

  logProgress(defId, `start topic=${topic}`);

  try {
    const loaded = await loadKnowledgeCorpusForNeed(topic, need);

    if (!loaded.corpus.trim()) {
      await writeGate({
        ok: false,
        error: 'empty corpus — wiki and export yielded no content for topic',
      });
      logProgress(defId, 'done ok=false error=empty corpus');
      process.exit(1);
    }

    const checklist = await fs.readFile(path.join(defRoot, 'checklist.md'), 'utf8');
    const corpusSlice = loaded.corpus.slice(0, 120_000);
    const auditJson = JSON.stringify({ auditIssues, topic }, null, 2);

    const content = await runSingleLlmCompletion({
      defId,
      messages: [
        { content: SYSTEM_PROMPT, role: 'system' },
        {
          content: [
            `Topic: ${topic}`,
            '## Checklist\n',
            checklist,
            '\n## Audit issues\n',
            auditJson,
            '\n## Corpus\n',
            corpusSlice,
          ].join('\n'),
          role: 'user',
        },
      ],
    });

    const review = parseKnowledgeQaReviewResponse(content);
    const gate = {
      ok: true,
      review: {
        ...review,
        topic: review.topic || topic,
      },
      source: loaded.source,
    };

    await writeGate(gate);
    logProgress(
      defId,
      `done ok=true source=${loaded.source} checks=${review.checks.length} todos=${review.todos.length}`,
    );
  } catch (error) {
    const gate = {
      ok: false,
      error: error instanceof Error ? error.message : 'knowledge-qa-review failed',
    };

    await writeGate(gate);
    logProgress(defId, `done ok=false error=${gate.error}`);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
