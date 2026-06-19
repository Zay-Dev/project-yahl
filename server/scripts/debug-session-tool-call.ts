import mongoose from 'mongoose';

import '@/core';
import config from '@/config';

import { parseToolSummaries } from '@/modules/sessions/-utils/normalize-tool-call';
import { modelSession, modelToolCall } from '@/modules/sessions/models';

const baseUrl = (process.argv[2]?.trim() || 'http://localhost:4000').replace(/\/+$/, '');
const sessionId = process.argv[3]?.trim() || 'a04c522a-364f-4031-9bd7-32a230689dea';
const requestId = process.argv[4]?.trim() || '2c96f2d3-5448-4d75-bce5-4323e0cdc283';

const VALID_SET_CONTEXT_ARGUMENTS =
  '{"scope":"context","key":"sections","value":[{"heading":"Tesla","body_md":"summary"}]}';

const INVALID_MONGO_ARGUMENTS =
  '{"scope": "types", "key": "TBriefSection", "value": {"type":"object","properties":{"title":{"type":"string"},"content":{"type":"string"},"items":{"type":"array","items":{"type":"object","properties":{"title":{"type":"string"},"summary":{"type":"string"},"sentiment":{"type":"string"},"date":{"type":"string"},"category":{"type":"string"},"source_url":{"type":"string"}}}}}}}}';

const printJson = (label: string, value: unknown) => {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(value, null, 2));
};

const testJsonValidity = (label: string, raw: string) => {
  try {
    JSON.parse(raw);
    console.log(`${label}: JSON.parse OK (${raw.length} chars)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.log(`${label}: JSON.parse FAIL — ${message} (${raw.length} chars)`);
  }
};

const runSynthetic = async () => {
  printJson('canonical shape', parseToolSummaries([
    {
      function: { arguments: VALID_SET_CONTEXT_ARGUMENTS, name: 'set_context' },
      id: 'call-canonical',
      type: 'function',
    },
  ]));

  printJson('invalid JSON shape (Mongo repro)', parseToolSummaries([
    {
      function: { arguments: INVALID_MONGO_ARGUMENTS, name: 'set_context' },
      id: 'call_00_Vjq2dBV7EyumPGe0zerI0720',
      type: 'function',
    },
  ]));

  printJson('top-level arguments shape', parseToolSummaries([
    {
      arguments: VALID_SET_CONTEXT_ARGUMENTS,
      function: { name: 'set_context' },
      id: 'call-top-level',
    },
  ]));
};

const runLive = async () => {
  const session = await modelSession.findOne({ sessionId }).lean();

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const sessionRef = session._id;

  const toolCallDocs = await modelToolCall
    .find({ requestId, session: sessionRef })
    .sort({ createdAt: 1 })
    .lean();

  printJson('Mongo SessionToolCalls docs', toolCallDocs);

  for (const doc of toolCallDocs) {
    const stored = Array.isArray(doc.toolCalls) ? doc.toolCalls : [];

    for (const entry of stored) {
      const fn = (entry as Record<string, unknown>).function as { arguments?: string; name?: string } | undefined;
      const raw = fn?.arguments;

      if (typeof raw === 'string') {
        testJsonValidity(`Mongo stored arguments (${fn?.name ?? 'unknown'})`, raw);
      }
    }

    printJson('parseToolSummaries from Mongo', parseToolSummaries(stored as Record<string, unknown>[]));
  }

  const apiUrl = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/stages/${encodeURIComponent(requestId)}`;

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error(`GET ${apiUrl} failed: ${response.status} ${response.statusText}`);
    } else {
      const detail = await response.json() as { toolCalls?: { tools: { arguments: unknown; id: string; name: string }[] }[] };

      printJson(`GET stage detail (${apiUrl})`, detail.toolCalls);

      for (const doc of detail.toolCalls ?? []) {
        for (const tool of doc.tools) {
          const args = tool.arguments;

          if (typeof args === 'string') {
            testJsonValidity(`API tool.arguments (${tool.name})`, args);
          } else if (args && typeof args === 'object') {
            console.log(`API tool.arguments (${tool.name}): parsed object`);
          } else {
            console.log(`API tool.arguments (${tool.name}): ${String(args)}`);
          }
        }
      }
    }
  } catch (error) {
    console.error(`GET ${apiUrl} skipped: ${String(error)}`);
  }
};

const main = async () => {
  console.log(`baseUrl=${baseUrl}`);
  console.log(`sessionId=${sessionId}`);
  console.log(`requestId=${requestId}`);

  testJsonValidity('fixture INVALID_MONGO_ARGUMENTS', INVALID_MONGO_ARGUMENTS);
  testJsonValidity('fixture VALID_SET_CONTEXT_ARGUMENTS', VALID_SET_CONTEXT_ARGUMENTS);

  await runSynthetic();

  await mongoose.connect(config.mongoDb.url);

  try {
    await runLive();
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
