import fs from 'node:fs/promises';
import path from 'node:path';

import { clipText, TOOL_OUTPUT_CHARS } from './snapshot-catalog.mjs';

export const readContextKeyTool = {
  function: {
    description: 'Read one context key from the on-disk snapshot. Large values are truncated.',
    name: 'read_context_key',
    parameters: {
      properties: {
        key: {
          description: 'Context key name',
          type: 'string',
        },
      },
      required: ['key'],
      type: 'object',
    },
  },
  type: 'function',
};

export const readTypeKeyTool = {
  function: {
    description: 'Read one types key from the on-disk snapshot. Large values are truncated.',
    name: 'read_type_key',
    parameters: {
      properties: {
        key: {
          description: 'Types key name',
          type: 'string',
        },
      },
      required: ['key'],
      type: 'object',
    },
  },
  type: 'function',
};

export const writeVerifyResultTool = {
  function: {
    description: 'Write the verify gate JSON to the output file (default result.json).',
    name: 'write_workspace_file',
    parameters: {
      properties: {
        content: {
          description: 'Full verify gate JSON content.',
          type: 'string',
        },
        path: {
          description: 'Path under /workspace/, e.g. result.json',
          type: 'string',
        },
      },
      required: ['path', 'content'],
      type: 'object',
    },
  },
  type: 'function',
};

export const VERIFY_TOOLS = [
  readContextKeyTool,
  readTypeKeyTool,
  writeVerifyResultTool,
];

export const resolveAllowedOutputPath = (filePath, outputName, workspace) => {
  const trimmed = typeof filePath === 'string' ? filePath.trim() : '';

  if (!trimmed) {
    throw new Error('path is required');
  }

  const target = path.resolve(trimmed.startsWith('/') ? trimmed : path.join(workspace, trimmed));
  const allowed = path.resolve(workspace, outputName);

  if (target !== allowed) {
    throw new Error(`path must be ${outputName} under workspace`);
  }

  return target;
};

export const readSnapshotKey = (params) => {
  const key = typeof params.key === 'string' ? params.key.trim() : '';
  const bucket = params.bucket === 'types' ? 'types' : 'context';
  const record = params.snapshot?.[bucket];
  const maxChars = Number.isFinite(params.maxChars) ? params.maxChars : TOOL_OUTPUT_CHARS;

  if (!key) {
    return `missing ${bucket} key: (empty)`;
  }

  if (!record || typeof record !== 'object' || !Object.hasOwn(record, key)) {
    return `missing ${bucket} key: ${key}`;
  }

  const raw = JSON.stringify(record[key]) ?? 'null';

  return clipText(raw, maxChars).text;
};

export const handleWriteVerifyResult = async (params) => {
  const target = resolveAllowedOutputPath(
    params.filePath,
    params.outputName,
    params.workspace,
  );

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, params.content, 'utf8');

  try {
    const parsed = params.parseVerify(params.content);

    return {
      message: `wrote ${target} (${params.content.length} chars)`,
      parsed,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return {
      message: `wrote ${target} but invalid verify JSON: ${reason}`,
      parsed: null,
    };
  }
};

export const handleVerifyToolCall = async (params) => {
  const name = params.toolCall?.function?.name ?? '';
  let args = {};

  try {
    args = JSON.parse(params.toolCall?.function?.arguments || '{}');
  } catch {
    args = {};
  }

  try {
    if (name === 'read_context_key') {
      return {
        message: readSnapshotKey({
          bucket: 'context',
          key: args.key,
          maxChars: params.maxChars,
          snapshot: params.snapshot,
        }),
        parsed: null,
      };
    }

    if (name === 'read_type_key') {
      return {
        message: readSnapshotKey({
          bucket: 'types',
          key: args.key,
          maxChars: params.maxChars,
          snapshot: params.snapshot,
        }),
        parsed: null,
      };
    }

    if (name === 'write_workspace_file') {
      return await handleWriteVerifyResult({
        content: String(args.content ?? ''),
        filePath: args.path,
        outputName: params.outputName,
        parseVerify: params.parseVerify,
        workspace: params.workspace,
      });
    }

    return {
      message: `unsupported tool: ${name}`,
      parsed: null,
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : 'tool failed',
      parsed: null,
    };
  }
};
