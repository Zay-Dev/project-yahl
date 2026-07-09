import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import {
  formatVerifyCliSpawnError,
  isCliEmptyResponse,
  isSdkRetryableError,
} from '@project-yahl/shared/verify/verify-infra';

import { config } from '../config.js';

const retryCount = () => Math.max(0, config.verifyCliMaxRetries);

const RETRY_DELAYS_MS = [1000, 3000];

const sleep = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

const writeCliOutput = (logPath: string, payload: Record<string, unknown>) => {
  fs.writeFileSync(logPath, JSON.stringify(payload));
};

export const runKnowledgeQaCli = async (jobDir: string, prompt: string): Promise<string> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryCount(); attempt += 1) {
    try {
      const stdout = await spawnKnowledgeQaCliOnce(jobDir, prompt);

      if (isCliEmptyResponse(stdout)) {
        throw new Error('empty cli response');
      }

      return stdout;
    } catch (error) {
      lastError = formatVerifyCliSpawnError(error);

      const retryable = isSdkRetryableError(lastError)
        || (lastError instanceof Error && lastError.message === 'empty cli response');

      if (!retryable || attempt >= retryCount()) {
        throw lastError;
      }

      await sleep(RETRY_DELAYS_MS[attempt]!);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

const spawnKnowledgeQaCliOnce = (jobDir: string, prompt: string): Promise<string> => {
  const logPath = path.join(jobDir, 'cli-output.json');

  if (!config.apiKey) {
    const stub = JSON.stringify({
      checks: [],
      summary: '[knowledge-qa-stub] CURSOR_API_KEY missing',
      todos: [],
      topic: 'unknown',
    });

    writeCliOutput(logPath, { result: stub });
    fs.writeFileSync(path.join(jobDir, 'result.json'), stub);

    return Promise.resolve(stub);
  }

  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--force',
      '--yolo',
      '--output-format',
      'json',
      prompt,
    ];

    const child = spawn('agent', args, {
      cwd: jobDir,
      env: {
        ...process.env,
        CURSOR_API_KEY: config.apiKey,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      writeCliOutput(logPath, {
        error: formatVerifyCliSpawnError(error).message,
        spawnError: error instanceof Error ? error.message : String(error),
      });
      reject(formatVerifyCliSpawnError(error));
    });

    child.on('close', (code) => {
      if (stdout.trim()) {
        writeCliOutput(logPath, { stdout: stdout.slice(0, 8000) });
      } else {
        writeCliOutput(logPath, {
          code,
          stderr: stderr.slice(0, 500),
        });
      }

      if (code !== 0) {
        reject(new Error(`knowledge-qa cli exited ${code}${stderr ? `: ${stderr.slice(0, 200)}` : ''}`));
        return;
      }

      resolve(stdout);
    });
  });
};
