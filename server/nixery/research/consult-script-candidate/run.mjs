import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { runSingleLlmCompletion } from '../lib/llm-completion.mjs';
import {
  appendNixeryRetryUserMessage,
  readNixeryRetryFeedback,
} from '../lib/nixery-retry-feedback.mjs';
import { logProgress, resolveDefId } from '../lib/run-agent.mjs';
import {
  extractJsonFromText,
  readGuidelineSnippet,
  readSessionFile,
} from '../lib/session-fs.mjs';

const SCRIPT_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const TASK_ID_PATTERN = /^[a-zA-Z0-9_.-]+$/;
const SESSION_SCRIPTS_DIR = '/session/scripts';
const SESSION_DATA_SCRIPTS_DIR = '/session/data/scripts';
const TASKS_ROOT = '/tasks';
const PER_FILE_CHARS = 2_000;
const TOTAL_SNIPPET_CHARS = 12_000;
const KINDS = new Set(['js', 'recipe', 'normalize']);

export const parseExisting = (raw) => {
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }

  const trimmed = raw.trim();

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);

      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim().replace(/\.(js|recipe\.json|meta\.json)$/i, ''))
          .filter(Boolean);
      }
    } catch {
      // fall through
    }
  }

  return trimmed
    .split(/[\n,]+/)
    .map((item) => item.trim().replace(/\.(js|recipe\.json|meta\.json)$/i, ''))
    .filter(Boolean);
};

const scriptIdFromName = (name) => {
  const js = name.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\.js$/);

  if (js?.[1]) {
    return { id: js[1], kind: 'js' };
  }

  const recipe = name.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\.recipe\.json$/);

  if (recipe?.[1]) {
    return { id: recipe[1], kind: 'recipe' };
  }

  const meta = name.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\.meta\.json$/);

  if (meta?.[1]) {
    return { id: meta[1], kind: 'meta' };
  }

  return null;
};

export const taskScriptsDir = (taskId) => {
  const trimmed = typeof taskId === 'string' ? taskId.trim() : '';

  if (trimmed && TASK_ID_PATTERN.test(trimmed) && !trimmed.includes('..') && !trimmed.includes('/')) {
    return path.join(TASKS_ROOT, trimmed, 'scripts');
  }

  return null;
};

export const resolveScriptsDir = (taskId) =>
  taskScriptsDir(taskId) ?? SESSION_SCRIPTS_DIR;

export const listScriptInventory = async (scriptsDir = SESSION_SCRIPTS_DIR) => {
  let names = [];

  try {
    names = await fs.readdir(scriptsDir);
  } catch {
    return { ids: [], snippets: [], scriptsDir };
  }

  const ids = new Set();
  const snippets = [];
  let used = 0;

  for (const name of names.sort()) {
    const parsed = scriptIdFromName(name);

    if (!parsed || !SCRIPT_ID_PATTERN.test(parsed.id)) {
      continue;
    }

    ids.add(parsed.id);

    if (parsed.kind === 'meta' || used >= TOTAL_SNIPPET_CHARS) {
      continue;
    }

    let body = '';

    try {
      body = await fs.readFile(path.join(scriptsDir, name), 'utf8');
    } catch {
      continue;
    }

    const slice = body.slice(0, PER_FILE_CHARS);
    const room = TOTAL_SNIPPET_CHARS - used;

    if (room <= 0) {
      break;
    }

    const text = slice.length > room ? slice.slice(0, room) : slice;

    snippets.push({ file: name, id: parsed.id, text });
    used += text.length;
  }

  return { ids: [...ids].sort(), snippets, scriptsDir };
};

export const resolveInventoryScriptsDir = async (taskId) => {
  const candidates = [SESSION_SCRIPTS_DIR, SESSION_DATA_SCRIPTS_DIR];
  const taskDir = taskScriptsDir(taskId);

  if (taskDir) {
    candidates.push(taskDir);
  }

  for (const dir of candidates) {
    const inventory = await listScriptInventory(dir);

    if (inventory.ids.length > 0 || inventory.snippets.length > 0) {
      return inventory;
    }
  }

  return listScriptInventory(SESSION_SCRIPTS_DIR);
};

export const mergeExistingIds = (fromInput, fromFs) =>
  [...new Set([...fromInput, ...fromFs].filter((id) => SCRIPT_ID_PATTERN.test(id)))].sort();

export const buildMessages = ({
  mission,
  need,
  pain,
  stageHint,
  stageBrief,
  plan,
  existingScripts,
  snippets,
  scriptsDir,
  guidelineContent,
  sourceContent,
}) => {
  const consultNeed = (need || pain || '').trim();
  const snippetBlock = snippets.length === 0
    ? `(no script bodies available under ${scriptsDir || 'scripts dir'})`
    : snippets
      .map((item) => `--- ${item.file} ---\n${item.text}`)
      .join('\n\n');

  return [
    {
      role: 'system',
      content: [
        'You are the YAHL operation-script consultant.',
        'Return JSON only with shape:',
        '{"action":"advise"|"skip","scriptId":string|null,"kind":"js"|"recipe"|"normalize"|null,"contract":string|null,"reasons":string[],"existingScripts":string[],"notesHint":string}',
        'Advise at most ONE next small script (or skip). Never a multi-op monolith.',
        'kind must be js|recipe|normalize when action is advise; null when skip.',
        'Prefer kind js for browser ops: agent-authored ~/data/scripts/*.js that drive Stagehand via yahl-browser (agent-free). kind recipe is legacy ordered payloads; prefer js+yahl-browser when advising new browser work.',
        'scriptId / kind / contract must be null when action is skip.',
        'contract describes stdin→stdout and, for browser scripts, that the script calls yahl-browser — no session place names or other run literals.',
        'Before advising: prefer reuse/extend from the script inventory and guideline/source excerpts.',
        'Session layout under /session (scripts, root *.md knowledge, nixery/, data/, task-skills/, plans/) is mounted — weigh that context when provided in this prompt.',
        'Prefer a normalize companion or rewrite of one existing op over inventing a whole-fetch super script.',
        'KTS notes: always set notesHint to a short non-empty string the stage agent should use (or paraphrase) for set_context __knowledge-to-script__notes.',
        'notesHint must name any ad-hoc free-flow / one-off bash or stage-agent browser that should become a yahl-browser script (or say none), and either that a script should be created/grown or why no new script after consideration.',
        'notesHint must NOT list scripts already run — that is normal stage work, not notes content.',
        'notesHint must NOT be only "reviewed" or "inventory covers" when the stage reports observe-recovery, act ok:false that still completed the op, free-flow browser, or stage-agent browser click loops that should be scripted — those cases usually need a rewrite/grow advise.',
        'When stageBrief/need reports observe-recovery / extract ok:false then observe / act ok:false with success / free-flow or stage-agent browser that should be agent-free: prefer action advise to rewrite/grow a js script (yahl-browser) or normalize companion; do not skip with inventory-covers unless first-try script already matched the successful chain.',
        'skip when reuse already covers the need with no recovery divergence, inventory is enough, or mission/need/stageBrief/plan context is too thin to advise safely.',
        'Echo existingScripts as the merged inventory ids you were given.',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        mission ? `Mission:\n${mission}` : '',
        stageBrief ? `Stage brief:\n${stageBrief}` : '',
        plan ? `Plan:\n${plan}` : '',
        consultNeed ? `Need:\n${consultNeed}` : 'Need: (none)',
        pain && need ? `Pain (legacy):\n${pain}` : '',
        `stageHint: ${stageHint || '(none)'}`,
        `scriptsDir: ${scriptsDir || '(unknown)'}`,
        `existingScripts: ${JSON.stringify(existingScripts)}`,
        'Session paths to inspect when needed: /session/scripts, /session/*.md, /session/nixery/, /session/data/, /session/task-skills/, /session/plans/',
        guidelineContent || '',
        sourceContent
          ? `Source / ops excerpt:\n${sourceContent}`
          : '',
        'Script snippets (truncated):',
        snippetBlock,
      ].filter(Boolean).join('\n\n'),
    },
  ];
};

export const normalizeNotesHint = (parsed) => {
  if (typeof parsed?.notesHint === 'string' && parsed.notesHint.trim()) {
    return parsed.notesHint.trim();
  }

  if (Array.isArray(parsed?.reasons)) {
    const fromReasons = parsed.reasons
      .map((item) => String(item).trim())
      .find((item) => /^notes:\s*/i.test(item));

    if (fromReasons) {
      return fromReasons.replace(/^notes:\s*/i, '').trim();
    }
  }

  return '';
};

export const normalizeGate = (parsed, existingScripts) => {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('consult-script-candidate returned invalid JSON');
  }

  const action = parsed.action === 'advise' ? 'advise' : parsed.action === 'skip' ? 'skip' : null;

  if (!action) {
    throw new Error('consult-script-candidate action must be advise or skip');
  }

  const reasons = Array.isArray(parsed.reasons)
    ? parsed.reasons.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (reasons.length === 0) {
    throw new Error('consult-script-candidate reasons must be a non-empty string array');
  }

  const notesHint = normalizeNotesHint(parsed);

  if (!notesHint) {
    throw new Error('consult-script-candidate requires non-empty notesHint');
  }

  if (action === 'skip') {
    return {
      action: 'skip',
      scriptId: null,
      kind: null,
      contract: null,
      reasons,
      existingScripts,
      notesHint,
    };
  }

  const scriptId = typeof parsed.scriptId === 'string' ? parsed.scriptId.trim() : '';
  const kind = typeof parsed.kind === 'string' ? parsed.kind.trim() : '';
  const contract = typeof parsed.contract === 'string' ? parsed.contract.trim() : '';

  if (!SCRIPT_ID_PATTERN.test(scriptId)) {
    throw new Error('consult-script-candidate advise requires valid scriptId');
  }

  if (!KINDS.has(kind)) {
    throw new Error('consult-script-candidate advise kind must be js|recipe|normalize');
  }

  if (!contract) {
    throw new Error('consult-script-candidate advise requires non-empty contract');
  }

  return {
    action: 'advise',
    scriptId,
    kind,
    contract,
    reasons,
    existingScripts,
    notesHint,
  };
};

export const EMPTY_CONTENT_RETRY_NUDGE =
  'Reply with the gate JSON object only — no prose. Shape: '
  + '{"action":"advise"|"skip","scriptId":string|null,"kind":"js"|"recipe"|"normalize"|null,'
  + '"contract":string|null,"reasons":string[],"existingScripts":string[],"notesHint":string}';

export const isRetryableConsultLlmFailure = (error) => {
  const message = error instanceof Error ? error.message : String(error);

  return /empty LLM content/i.test(message) || /finish_reason=length/i.test(message);
};

export const completeGateLlmContent = async ({
  defId,
  messages,
  complete = runSingleLlmCompletion,
}) => {
  let content = '';

  try {
    content = await complete({ defId, messages, round: 0 });
  } catch (error) {
    if (!isRetryableConsultLlmFailure(error)) {
      throw error;
    }

    logProgress(defId, `llm empty/truncated; retrying once (${error instanceof Error ? error.message : error})`);
    messages.push({ content: EMPTY_CONTENT_RETRY_NUDGE, role: 'user' });
    content = await complete({ defId, messages, round: 1 });
  }

  if (!String(content ?? '').trim()) {
    logProgress(defId, 'llm empty on first pass; retrying once with JSON-only nudge');
    messages.push({ content: EMPTY_CONTENT_RETRY_NUDGE, role: 'user' });
    content = await complete({ defId, messages, round: 1 });
  }

  if (!String(content ?? '').trim()) {
    throw new Error('consult-script-candidate returned empty LLM content');
  }

  return String(content).trim();
};

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

  const fromInput = parseExisting(
    typeof input.existingScripts === 'string' ? input.existingScripts : '',
  );
  const pain = typeof input.pain === 'string' ? input.pain.trim() : '';
  const need = typeof input.need === 'string' ? input.need.trim() : '';
  const mission = typeof input.mission === 'string' ? input.mission.trim() : '';
  const stageHint = typeof input.stageHint === 'string' ? input.stageHint.trim() : '';
  const stageBrief = typeof input.stageBrief === 'string' ? input.stageBrief.trim() : '';
  const plan = typeof input.plan === 'string' ? input.plan.trim() : '';
  const taskId = typeof input.taskId === 'string' ? input.taskId.trim() : '';

  const inventory = await resolveInventoryScriptsDir(taskId);
  const existingScripts = mergeExistingIds(fromInput, inventory.ids);
  const guidelineContent = await readGuidelineSnippet(input.guidelinePath);
  const sourceContent = typeof input.source === 'string' && input.source.trim()
    ? await readSessionFile(input.source, 8_000)
    : '';

  logProgress(
    defId,
    `start existing=${existingScripts.length} snippets=${inventory.snippets.length} `
    + `dir=${inventory.scriptsDir} need=${(need || pain).slice(0, 60)}`,
  );

  const messages = buildMessages({
    mission,
    need,
    pain,
    stageHint,
    stageBrief,
    plan,
    existingScripts,
    snippets: inventory.snippets,
    scriptsDir: inventory.scriptsDir,
    guidelineContent,
    sourceContent,
  });

  appendNixeryRetryUserMessage(messages, readNixeryRetryFeedback(input));

  const content = await completeGateLlmContent({ defId, messages });

  const parsed = extractJsonFromText(content);
  const gate = normalizeGate(parsed, existingScripts);

  await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
  logProgress(defId, `done action=${gate.action} scriptId=${gate.scriptId ?? 'none'}`);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
