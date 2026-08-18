import path from 'path';

import { createWriteStream } from 'fs';
import { promises as fs } from 'fs';

import { sessionWorkspaceRoot } from '@project-yahl/shared/yahl/workspace-paths';

export const agentDiagnosticsLogPath = (sessionId: string) =>
  path.join(sessionWorkspaceRoot(sessionId), 'diagnostics', 'agent.log');

export const agentDiagnosticsLogAgentPath = () => '~/diagnostics/agent.log';

export type TAgentDiagnosticsLog = {
  dispose: () => void;
  logPath: string;
};

const formatArg = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return value.stack ?? value.message;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const startAgentDiagnosticsLog = async (sessionId: string): Promise<TAgentDiagnosticsLog> => {
  const logPath = agentDiagnosticsLogPath(sessionId);

  await fs.mkdir(path.dirname(logPath), { recursive: true });

  const stream = createWriteStream(logPath, { flags: 'a' });

  const writeLine = (level: string, args: unknown[]) => {
    const line = args.map(formatArg).join(' ');

    stream.write(`[${new Date().toISOString()}] [${level}] ${line}\n`);
  };

  const origLog = console.log.bind(console);
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.log = (...args: unknown[]) => {
    origLog(...args);
    writeLine('log', args);
  };

  console.error = (...args: unknown[]) => {
    origError(...args);
    writeLine('error', args);
  };

  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    writeLine('warn', args);
  };

  origLog(`[agent-daemon] diagnostics log sessionId=${sessionId} path=${logPath}`);

  return {
    dispose: () => {
      console.log = origLog;
      console.error = origError;
      console.warn = origWarn;
      stream.end();
    },
    logPath,
  };
};
