import fs from 'node:fs/promises';
import path from 'node:path';

export const writeWorkspaceFileTool = {
  function: {
    description: 'Write a file under /workspace/. Use for primary markdown/json artifacts — not echo redirects.',
    name: 'write_workspace_file',
    parameters: {
      properties: {
        content: {
          description: 'Full file content to write.',
          type: 'string',
        },
        path: {
          description: 'Path under /workspace/, e.g. identity.md',
          type: 'string',
        },
      },
      required: ['path', 'content'],
      type: 'object',
    },
  },
  type: 'function',
};

export const writeWorkspaceFile = async ({ content, filePath }) => {
  const target = path.resolve(filePath.startsWith('/') ? filePath : path.join('/workspace', filePath));

  if (!target.startsWith('/workspace/') && target !== '/workspace') {
    throw new Error('path must be under /workspace/');
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');

  return `wrote ${target} (${content.length} chars)`;
};

export const handleWriteWorkspaceFileCall = async (args) => {
  const filePath = String(args.path ?? '').trim();
  const content = String(args.content ?? '');

  if (!filePath) {
    throw new Error('path is required');
  }

  return writeWorkspaceFile({ content, filePath });
};
